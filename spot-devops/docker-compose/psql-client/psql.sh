#!/usr/bin/env bash

######################################################################
## Iniitalize the environment
##
this="${BASH_SOURCE-$0}"
bin=$( cd -P -- "$( dirname -- "${this}" )" && pwd -P )
script="$( basename -- "${this}" )"
this="${bin}/${script}"
timestamp="$( date +%Y%m%d_%H%M%S )"
fqdn="$( hostname -f )"
debug_level=1

set -e
set -u
set -o pipefail

IFS=$'\n\t'

PSQL_COMMAND=${PSQL_COMMAND:-"psql"}

function finish {
    ## Put any custom cleanup code here
    ## ...
    echo "[psql-client] Finished."
}
trap finish EXIT

if test -e "${bin}/.env"; then
    source "${bin}/.env"
else
    echo "[psql-client] Unable to launch psql client.  Please configure a local .env configuration file and try again."
    exit 1
fi

set -x
if ! docker images | grep -q "^${PSQL_CLIENT_IMAGE_NAME}\s\s*${PSQL_CLIENT_IMAGE_TAG}"; then
    echo "[psql-client] Psql client image [${PSQL_CLIENT_IMAGE_NAME}:${PSQL_CLIENT_IMAGE_TAG}] not detected.  Building now..."
    docker build \
        --tag ${PSQL_CLIENT_IMAGE_NAME}:${PSQL_CLIENT_IMAGE_TAG} \
        --file "${bin}/Dockerfile" \
        "${bin}"
fi
set +x

echo "[psql-client] Launching psql client..."
docker run \
    --rm \
    --interactive \
    --tty \
    --network postgis_postgis \
    --env "PGDATABASE=${PGSQL_DB}" \
    --env "PGHOST=${PGSQL_DB_HOST}" \
    --env "PGPORT=${PGSQL_DB_PORT}" \
    --env "PGUSER=${PGSQL_DB_USERNAME}" \
    --env "PGPASSWORD=${PGSQL_DB_PASSWORD}" \
    --user postgres \
    ${PSQL_CLIENT_IMAGE_NAME}:${PSQL_CLIENT_IMAGE_TAG} \
    ${PSQL_COMMAND}



