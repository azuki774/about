{
  description = "Development environment with gh, bun, node (pinned versions)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: let
    # 指定バージョン用オーバーレイ（gh 2.87.3, bun 1.3.10, node 24.14.0）
    versionOverlay = final: prev: let
      sys = prev.stdenv.hostPlatform.system;
      bunSrc = if sys == "x86_64-linux" then
        prev.fetchurl {
          url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.10/bun-linux-x64.zip";
          hash = "sha256-9XvAGH45Yj3nFro6OJ/aVIay175xMamAulTce3M9Lgg=";
        }
      else if sys == "aarch64-darwin" then
        prev.fetchurl {
          url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.10/bun-darwin-aarch64.zip";
          hash = "sha256-ggNOh8nZtDmOphmu4u7V0qaMgVfppq4tEFLYTVM8zY0=";
        }
      else
        null;
      nodePrebuilt = if sys == "x86_64-linux" then {
        url = "https://nodejs.org/dist/v24.14.0/node-v24.14.0-linux-x64.tar.xz";
        hash = "sha256-Qc15u3h3yBYFqeaOxMkVR3dPRqQMZ6F+NNcXnvEXKd8=";
      } else if sys == "aarch64-darwin" then {
        url = "https://nodejs.org/dist/v24.14.0/node-v24.14.0-darwin-arm64.tar.xz";
        hash = "sha256-RI8B1N+loh0oDPus8Aq8IrUarVLzjbD0iG4OXQDfVB0=";
      } else
        null;
      nodejs_24_custom = prev.stdenv.mkDerivation {
        pname = "nodejs";
        version = "24.14.0";
        src = prev.fetchurl { inherit (nodePrebuilt) url hash; };
        dontConfigure = true;
        dontBuild = true;
        installPhase = ''
          runHook preInstall
          mkdir -p $out
          tar xf $src -C $out --strip-components=1
          runHook postInstall
        '';
        postFixup = ''
          patchShebangs --host $out
        '';
        passthru = prev.nodejs_24.passthru or { };
        meta = (prev.nodejs_24.meta or { }) // { mainProgram = "node"; };
      };
    in {
      nodejs_24 = if nodePrebuilt != null then nodejs_24_custom else prev.nodejs_24;

      gh = prev.gh.overrideAttrs (old: {
        version = "2.87.3";
        src = prev.fetchFromGitHub {
          owner = "cli";
          repo = "cli";
          rev = "v2.87.3";
          hash = "sha256-F4xUwj/krB5vjIfnvmwySlztBrcxJ+k1GvXb2gs7eXY=";
        };
      });

      bun = if bunSrc != null then prev.bun.overrideAttrs (old: {
        version = "1.3.10";
        src = bunSrc;
      }) else prev.bun;
    };

    pkgsFor = system: import nixpkgs {
      inherit system;
      overlays = [ versionOverlay ];
    };

    pkgs = pkgsFor "x86_64-linux";
    pkgsDarwinWithBun = pkgsFor "aarch64-darwin";
  in {
    devShells.x86_64-linux.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        gh
        bun
        nodejs_24
      ];
      shellHook = ''
        echo "gh:  $(gh --version | head -1)"
        echo "bun: $(bun --version)"
        echo "node: $(node --version)"
      '';
    };

    devShells.aarch64-darwin.default = pkgsDarwinWithBun.mkShell {
      buildInputs = with pkgsDarwinWithBun; [
        gh
        bun
        nodejs_24
      ];
      shellHook = ''
        echo "gh:  $(gh --version | head -1)"
        echo "bun: $(bun --version)"
        echo "node: $(node --version)"
      '';
    };

    devShell.x86_64-linux = self.devShells.x86_64-linux.default;
    devShell.aarch64-darwin = self.devShells.aarch64-darwin.default;
  };
}
