# Fallback default.nix for non-flake Nix usage
# Uses standard nixpkgs Rust (no rust-overlay needed)

{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Rust toolchain from nixpkgs
    rustc
    cargo
    
    # System dependencies
    openssl
    pkg-config
    libpq
    python3
    socat
    curl
    
    # Build tools
    git
  ];

  CARGO_NET_GIT_FETCH_WITH_CLI = "true";
  
  LD_LIBRARY_PATH = with pkgs; lib.makeLibraryPath [
    openssl
    libpq
  ];
}

