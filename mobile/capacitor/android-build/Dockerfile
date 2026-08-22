# Android SDK + Gradle build image for mobile/capacitor's build.sh.
# One-time, multi-GB cost — see mobile/capacitor/FLOWS.md's Technology Notes.
# Tagged locally as `communicator-android-builder`; never pushed anywhere.
#
# Base is eclipse-temurin:21-jdk (Ubuntu) rather than node:20 (Debian bookworm):
# bookworm's apt repos only carry openjdk-17-jdk, not 21 (not even in
# bookworm-backports at the time this was written) — Temurin ships JDK 21
# directly and Ubuntu's own repos carry a recent Node.js/npm, so this avoids
# needing NodeSource or a JDK PPA.
FROM eclipse-temurin:21-jdk

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        nodejs \
        npm \
        unzip \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools

# Android cmdline-tools (pinned version known to work with sdkmanager's expected layout)
ARG CMDLINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
    && curl -fsSL -o /tmp/cmdline-tools.zip "${CMDLINE_TOOLS_URL}" \
    && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools \
    && mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip

# Accept all SDK licenses non-interactively, then install the pieces we need.
RUN yes | sdkmanager --licenses > /dev/null || true \
    && sdkmanager --install \
        "platform-tools" \
        "build-tools;34.0.0" \
        "platforms;android-34" \
    && yes | sdkmanager --licenses > /dev/null || true

WORKDIR /project
