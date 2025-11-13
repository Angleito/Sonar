# Bazel BUILD file for sonar-audio-verifier
# This uses genrule to install Python packages using UV, leveraging Bazel's caching

# Install Python dependencies using UV
genrule(
    name = "dependencies",
    srcs = glob([
        "pyproject.toml",
        "*.py",
    ]),
    outs = ["deps-installed"],
    cmd = """
        uv pip install --system . && \
        touch $$(location deps-installed)
    """,
    message = "Installing Python dependencies with UV",
    local = 1,  # Run locally to preserve UV's caching
)

# Build the application package
genrule(
    name = "app",
    srcs = glob([
        "pyproject.toml",
        "*.py",
    ]),
    outs = ["app-installed"],
    tools = [":dependencies"],
    cmd = """
        uv pip install --system . && \
        touch $$(location app-installed)
    """,
    message = "Building application package",
    local = 1,
)

# Filegroup for the complete application
filegroup(
    name = "application",
    srcs = [
        ":app",
        ":dependencies",
    ],
)

