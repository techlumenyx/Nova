FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y curl bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Rover CLI
RUN curl -sSL https://rover.apollo.dev/nix/latest | APOLLO_NO_UPDATE_NOTIFIER=1 sh
ENV PATH="/root/.rover/bin:$PATH"

# Install Apollo Router into /usr/local/bin
ARG ROUTER_VERSION=1.57.1
RUN curl -sSL "https://router.apollo.dev/download/nix/v${ROUTER_VERSION}" -o /tmp/router-install.sh && \
    sh /tmp/router-install.sh && \
    mv ./router /usr/local/bin/router && \
    chmod +x /usr/local/bin/router && \
    router --version

COPY router.yaml /config/router.yaml
COPY supergraph.yaml /config/supergraph.yaml
COPY supergraph.graphql /config/supergraph.graphql
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
