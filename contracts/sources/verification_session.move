/// SONAR Verification Session Module
///
/// Manages the verification lifecycle with on-chain state tracking.
/// Coordinates between user uploads, off-chain verifier worker, and final submission creation.
#[allow(unused_const, duplicate_alias)]
module sonar::verification_session {
    use std::option::{Self, Option};
    use std::string::{Self, String};
    use std::vector;
    use sui::event;
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::vec_map::{Self, VecMap};

    // ========== Error Codes ==========

    // Session lifecycle errors (8000-8999)
    const E_INVALID_STATE_TRANSITION: u64 = 8001;
    const E_SESSION_NOT_VERIFIED: u64 = 8002;
    const E_SESSION_ALREADY_FINALIZED: u64 = 8003;
    const E_UNAUTHORIZED: u64 = 8004;
    const E_DELETION_NOT_CONFIRMED: u64 = 8005;
    const E_ENCRYPTION_NOT_SUBMITTED: u64 = 8006;
    const E_VERIFICATION_FAILED: u64 = 8007;
    const E_INVALID_STAGE: u64 = 8008;

    // ========== Constants ==========

    // Session status constants
    const STATUS_UPLOADING: u8 = 0;
    const STATUS_VERIFYING: u8 = 1;
    const STATUS_AWAITING_DELETION: u8 = 2;
    const STATUS_ENCRYPTED: u8 = 3;
    const STATUS_EXPIRED: u8 = 4;
    const STATUS_FAILED: u8 = 5;

    // Verification stage constants
    const STAGE_QUEUED: u8 = 0;
    const STAGE_INGESTING: u8 = 1;
    const STAGE_QUALITY_CHECK: u8 = 2;
    const STAGE_COPYRIGHT_CHECK: u8 = 3;
    const STAGE_TRANSCRIPTION: u8 = 4;
    const STAGE_ANALYSIS: u8 = 5;
    const STAGE_FINALIZING: u8 = 6;
    const STAGE_COMPLETED: u8 = 7;
    const STAGE_FAILED: u8 = 8;

    // ========== Core Structs ==========

    /// Validator capability for verification operations
    public struct ValidatorCap has key, store {
        id: UID
    }

    /// Stage timestamp record
    public struct StageTimestamp has store, copy, drop {
        stage: u8,                   // STAGE_* constant
        started_at_epoch: u64,
        completed_at_epoch: u64,
        progress_percent: u8         // 0-100
    }

    /// Verification session tracking the full lifecycle
    public struct VerificationSession has key, store {
        id: UID,

        // Ownership
        owner: address,
        submission_id: Option<ID>,   // Set after finalization

        // Status tracking
        status: u8,                  // STATUS_* constant
        current_stage: u8,           // STAGE_* constant
        stage_timestamps: vector<StageTimestamp>,

        // Plaintext storage (before encryption)
        plaintext_cid: Option<String>,      // Walrus blob ID for raw audio
        plaintext_size_bytes: u64,

        // Encrypted storage (after encryption)
        encrypted_cid: Option<String>,      // Walrus blob ID for encrypted audio
        preview_cid: Option<String>,        // Preview audio blob ID
        seal_policy_id: Option<String>,      // Mysten Seal policy

        // Audio metadata
        duration_seconds: u64,              // Total audio duration
        file_format: String,                // e.g. "mp3", "wav", "flac"

        // Verification results (hashes for audit trail)
        transcript_hash: Option<vector<u8>>,        // SHA-256 of transcript JSON
        quality_metrics_hash: Option<vector<u8>>,   // SHA-256 of quality metrics JSON
        quality_score: u8,                          // 0-100
        safety_passed: bool,
        approved: bool,                             // Final verdict

        // Deletion tracking
        deletion_receipt_hash: Option<vector<u8>>,  // Proof of plaintext deletion
        deleted_at_epoch: u64,

        // Session metadata
        created_at_epoch: u64,
        finalized_at_epoch: u64
    }

    /// Shared session registry for indexing
    public struct SessionRegistry has key {
        id: UID,
        total_sessions: u64,
        active_sessions: u64,
        completed_sessions: u64,
        failed_sessions: u64,

        // Index by owner
        owner_sessions: VecMap<address, vector<ID>>  // owner -> session_ids
    }

    // ========== Events ==========

    public struct SessionCreated has copy, drop {
        session_id: ID,
        owner: address,
        plaintext_cid: String,
        plaintext_size_bytes: u64,
        created_at_epoch: u64
    }

    public struct StageUpdated has copy, drop {
        session_id: ID,
        owner: address,
        old_stage: u8,
        new_stage: u8,
        progress_percent: u8,
        current_epoch: u64
    }

    public struct VerificationCompleted has copy, drop {
        session_id: ID,
        owner: address,
        quality_score: u8,
        safety_passed: bool,
        approved: bool,
        transcript_hash: vector<u8>,
        quality_metrics_hash: vector<u8>,
        completed_at_epoch: u64
    }

    public struct DeletionConfirmed has copy, drop {
        session_id: ID,
        owner: address,
        plaintext_cid: String,
        deletion_receipt_hash: vector<u8>,
        deleted_at_epoch: u64
    }

    public struct EncryptedUploaded has copy, drop {
        session_id: ID,
        owner: address,
        encrypted_cid: String,
        seal_policy_id: String,
        uploaded_at_epoch: u64
    }

    public struct SessionFinalized has copy, drop {
        session_id: ID,
        owner: address,
        submission_id: ID,
        status: u8,
        finalized_at_epoch: u64
    }

    public struct SessionFailed has copy, drop {
        session_id: ID,
        owner: address,
        stage: u8,
        reason: String,
        failed_at_epoch: u64
    }

    public struct RegistryInitialized has copy, drop {
        registry_id: ID
    }

    // ========== Initialization ==========

    fun init(ctx: &mut TxContext) {
        // Create registry
        let registry = SessionRegistry {
            id: object::new(ctx),
            total_sessions: 0,
            active_sessions: 0,
            completed_sessions: 0,
            failed_sessions: 0,
            owner_sessions: vec_map::empty()
        };

        let registry_id = object::uid_to_inner(&registry.id);

        event::emit(RegistryInitialized {
            registry_id
        });

        transfer::share_object(registry);

        // Create and transfer ValidatorCap to deployer
        let validator_cap = ValidatorCap {
            id: object::new(ctx)
        };

        transfer::transfer(validator_cap, tx_context::sender(ctx));
    }

    // ========== Public Functions - User Actions ==========

    /// Create a new verification session after uploading plaintext to Walrus
    /// Called by user after uploading raw audio but before encryption
    public entry fun create_session(
        registry: &mut SessionRegistry,
        plaintext_cid: String,
        plaintext_size_bytes: u64,
        duration_seconds: u64,
        file_format: String,
        ctx: &mut TxContext
    ) {
        let owner = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);

        // Create session
        let session = VerificationSession {
            id: object::new(ctx),
            owner,
            submission_id: option::none(),
            status: STATUS_UPLOADING,
            current_stage: STAGE_QUEUED,
            stage_timestamps: vector::empty(),
            plaintext_cid: option::some(plaintext_cid),
            plaintext_size_bytes,
            encrypted_cid: option::none(),
            preview_cid: option::none(),
            seal_policy_id: option::none(),
            duration_seconds,
            file_format,
            transcript_hash: option::none(),
            quality_metrics_hash: option::none(),
            quality_score: 0,
            safety_passed: false,
            approved: false,
            deletion_receipt_hash: option::none(),
            deleted_at_epoch: 0,
            created_at_epoch: current_epoch,
            finalized_at_epoch: 0
        };

        let session_id = object::uid_to_inner(&session.id);

        // Update registry
        registry.total_sessions = registry.total_sessions + 1;
        registry.active_sessions = registry.active_sessions + 1;

        // Add to owner index
        if (vec_map::contains(&registry.owner_sessions, &owner)) {
            let sessions = vec_map::get_mut(&mut registry.owner_sessions, &owner);
            vector::push_back(sessions, session_id);
        } else {
            let sessions = vector::singleton(session_id);
            vec_map::insert(&mut registry.owner_sessions, owner, sessions);
        };

        // Emit event
        event::emit(SessionCreated {
            session_id,
            owner,
            plaintext_cid,
            plaintext_size_bytes,
            created_at_epoch: current_epoch
        });

        // Transfer session to owner
        transfer::transfer(session, owner);
    }

    /// Submit deletion receipt after verifier confirms plaintext deletion
    /// Called by user after verifier provides deletion proof
    public entry fun submit_deletion_receipt(
        session: &mut VerificationSession,
        deletion_receipt_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);

        // Validate ownership
        assert!(session.owner == caller, E_UNAUTHORIZED);

        // Must be in verifying state
        assert!(session.status == STATUS_VERIFYING, E_INVALID_STATE_TRANSITION);

        // Must have passed verification
        assert!(session.approved, E_VERIFICATION_FAILED);

        // Update session
        session.deletion_receipt_hash = option::some(deletion_receipt_hash);
        session.deleted_at_epoch = current_epoch;
        session.status = STATUS_AWAITING_DELETION;

        // Emit event
        event::emit(DeletionConfirmed {
            session_id: object::uid_to_inner(&session.id),
            owner: session.owner,
            plaintext_cid: *option::borrow(&session.plaintext_cid),
            deletion_receipt_hash,
            deleted_at_epoch: current_epoch
        });
    }

    /// Submit encrypted upload after encryption
    /// Called by user after encrypting with Seal and uploading to Walrus
    public entry fun submit_encrypted_upload(
        session: &mut VerificationSession,
        encrypted_cid: String,
        preview_cid: String,
        seal_policy_id: String,
        ctx: &mut TxContext
    ) {
        let caller = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);

        // Validate ownership
        assert!(session.owner == caller, E_UNAUTHORIZED);

        // Must have deletion confirmed
        assert!(
            session.status == STATUS_AWAITING_DELETION,
            E_INVALID_STATE_TRANSITION
        );

        // Update session
        session.encrypted_cid = option::some(encrypted_cid);
        session.preview_cid = option::some(preview_cid);
        session.seal_policy_id = option::some(seal_policy_id);
        session.status = STATUS_ENCRYPTED;

        // Emit event
        event::emit(EncryptedUploaded {
            session_id: object::uid_to_inner(&session.id),
            owner: session.owner,
            encrypted_cid,
            seal_policy_id,
            uploaded_at_epoch: current_epoch
        });
    }

    // ========== Public Functions - Verifier Actions ==========

    /// Update verification stage
    /// Called by off-chain verifier worker with ValidatorCap
    public entry fun update_stage(
        _cap: &ValidatorCap,
        session: &mut VerificationSession,
        registry: &mut SessionRegistry,
        new_stage: u8,
        progress_percent: u8,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);

        // Validate stage
        assert!(new_stage <= STAGE_FAILED, E_INVALID_STAGE);

        // Handle failure - emit event, update state, and update registry
        if (new_stage == STAGE_FAILED) {
            session.status = STATUS_FAILED;
            session.current_stage = new_stage;

            // Update registry counts
            if (registry.active_sessions > 0) {
                registry.active_sessions = registry.active_sessions - 1;
            };
            registry.failed_sessions = registry.failed_sessions + 1;

            event::emit(SessionFailed {
                session_id: object::uid_to_inner(&session.id),
                owner: session.owner,
                stage: session.current_stage,
                reason: string::utf8(b"Stage failed during verification"),
                failed_at_epoch: current_epoch
            });

            return
        };

        // Update stage
        let old_stage = session.current_stage;
        session.current_stage = new_stage;

        // Add timestamp record
        let timestamp = StageTimestamp {
            stage: new_stage,
            started_at_epoch: current_epoch,
            completed_at_epoch: current_epoch,
            progress_percent
        };
        vector::push_back(&mut session.stage_timestamps, timestamp);

        // Update status
        if (new_stage >= STAGE_INGESTING && session.status == STATUS_UPLOADING) {
            session.status = STATUS_VERIFYING;
        };

        // Emit event
        event::emit(StageUpdated {
            session_id: object::uid_to_inner(&session.id),
            owner: session.owner,
            old_stage,
            new_stage,
            progress_percent,
            current_epoch
        });
    }

    /// Finalize verification with results
    /// Called by verifier worker after all stages complete
    public entry fun finalize_verification(
        _cap: &ValidatorCap,
        session: &mut VerificationSession,
        quality_score: u8,
        safety_passed: bool,
        approved: bool,
        transcript_hash: vector<u8>,
        quality_metrics_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);

        // Validate state
        assert!(session.status == STATUS_VERIFYING, E_INVALID_STATE_TRANSITION);

        // Update session
        session.quality_score = quality_score;
        session.safety_passed = safety_passed;
        session.approved = approved;
        session.transcript_hash = option::some(transcript_hash);
        session.quality_metrics_hash = option::some(quality_metrics_hash);
        session.current_stage = STAGE_COMPLETED;

        // Emit event
        event::emit(VerificationCompleted {
            session_id: object::uid_to_inner(&session.id),
            owner: session.owner,
            quality_score,
            safety_passed,
            approved,
            transcript_hash,
            quality_metrics_hash,
            completed_at_epoch: current_epoch
        });
    }

    /// Mark session as failed
    /// Called by verifier if verification encounters unrecoverable error
    public entry fun fail_session(
        _cap: &ValidatorCap,
        session: &mut VerificationSession,
        reason: String,
        registry: &mut SessionRegistry,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);

        session.status = STATUS_FAILED;
        session.current_stage = STAGE_FAILED;

        // Update registry
        if (registry.active_sessions > 0) {
            registry.active_sessions = registry.active_sessions - 1;
        };
        registry.failed_sessions = registry.failed_sessions + 1;

        event::emit(SessionFailed {
            session_id: object::uid_to_inner(&session.id),
            owner: session.owner,
            stage: session.current_stage,
            reason,
            failed_at_epoch: current_epoch
        });
    }

    /// Link session to final submission
    /// Called by marketplace after creating AudioSubmission/DatasetSubmission
    public fun link_submission(
        session: &mut VerificationSession,
        submission_id: ID,
        registry: &mut SessionRegistry,
        ctx: &mut TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);

        // Must be encrypted
        assert!(session.status == STATUS_ENCRYPTED, E_ENCRYPTION_NOT_SUBMITTED);

        session.submission_id = option::some(submission_id);
        session.finalized_at_epoch = current_epoch;

        // Update registry
        if (registry.active_sessions > 0) {
            registry.active_sessions = registry.active_sessions - 1;
        };
        registry.completed_sessions = registry.completed_sessions + 1;

        event::emit(SessionFinalized {
            session_id: object::uid_to_inner(&session.id),
            owner: session.owner,
            submission_id,
            status: session.status,
            finalized_at_epoch: current_epoch
        });
    }

    // ========== View Functions ==========

    public fun is_approved(session: &VerificationSession): bool {
        session.approved
    }

    public fun is_encrypted(session: &VerificationSession): bool {
        session.status == STATUS_ENCRYPTED
    }

    public fun is_failed(session: &VerificationSession): bool {
        session.status == STATUS_FAILED
    }

    // ========== Accessor Functions ==========

    public fun owner(session: &VerificationSession): address { session.owner }
    public fun status(session: &VerificationSession): u8 { session.status }
    public fun current_stage(session: &VerificationSession): u8 { session.current_stage }
    public fun quality_score(session: &VerificationSession): u8 { session.quality_score }
    public fun safety_passed(session: &VerificationSession): bool { session.safety_passed }
    public fun approved(session: &VerificationSession): bool { session.approved }
    public fun encrypted_cid(session: &VerificationSession): Option<String> { session.encrypted_cid }
    public fun preview_cid(session: &VerificationSession): Option<String> { session.preview_cid }
    public fun seal_policy_id(session: &VerificationSession): Option<String> { session.seal_policy_id }
    public fun duration_seconds(session: &VerificationSession): u64 { session.duration_seconds }
    public fun plaintext_size_bytes(session: &VerificationSession): u64 { session.plaintext_size_bytes }

    // Registry accessors
    public fun total_sessions(registry: &SessionRegistry): u64 { registry.total_sessions }
    public fun active_sessions(registry: &SessionRegistry): u64 { registry.active_sessions }
    public fun completed_sessions(registry: &SessionRegistry): u64 { registry.completed_sessions }
    public fun failed_sessions(registry: &SessionRegistry): u64 { registry.failed_sessions }

    // ========== Admin/Testing Functions ==========

    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_validator_cap_for_testing(ctx: &mut TxContext): ValidatorCap {
        ValidatorCap { id: object::new(ctx) }
    }
}
