{
  description = "SONAR Audio Verifier development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";  # Use unstable for Python 3.14 support
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        
        # Python 3.14 (latest stable)
        # Note: Requires nixos-unstable or newer nixpkgs for python314
        python314 = pkgs.python314;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Python 3.14
            python314
            
            # UV package manager
            uv
            
            # Build tools for compiling Python packages (especially pysui-fastcrypto)
            gcc
            rustc
            cargo
            pkg-config
            
            # System dependencies for audio processing
            ffmpeg
            chromaprint
            libsndfile
            
            # Bazel for build orchestration
            bazel_7
            
            # Git (needed for git dependencies)
            git
            
            # Additional build dependencies
            openssl
            zlib
          ];

          # Set up library paths for linking
          LD_LIBRARY_PATH = with pkgs; lib.makeLibraryPath [
            openssl
            zlib
            libsndfile
            ffmpeg
          ];
          
          shellHook = ''
            echo "🔧 SONAR Audio Verifier development environment"
            echo "Python version: $(python3.14 --version)"
            echo "UV version: $(uv --version)"
            echo "Bazel version: $(bazel --version)"
            echo ""
            echo "Available commands:"
            echo "  uv pip install ."
            echo "  bazel build //:app"
            echo "  BUILD_METHOD=bazel ./build.sh"
            echo "  BUILD_METHOD=uv ./build.sh"
          '';
        };

        # Build outputs
        packages.default = pkgs.stdenv.mkDerivation {
          name = "sonar-audio-verifier";
          src = ./.;
          
          buildInputs = with pkgs; [
            python314
            uv
            gcc
            rustc
            cargo
            pkg-config
            ffmpeg
            chromaprint
            libsndfile
            openssl
            zlib
            git
          ];
          
          buildPhase = ''
            uv pip install --system .
          '';
          
          installPhase = ''
            mkdir -p $out
            cp -r . $out/
          '';
        };
      }
    );
}

