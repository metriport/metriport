#!/bin/bash

if [[ -z "${IHE_GW_URL}" ]]; then
    if [[ -z "${IHE_GW_URL_OUTBOUND}" ]]; then
        echo "IHE_GW_URL_OUTBOUND is not set, trying IHE_GW_URL_INBOUND"
        if [[ -z "${IHE_GW_URL_INBOUND}" ]]; then
            echo "IHE_GW_URL_INBOUND is not set, exiting"
            exit 1
        else
            IHE_GW_URL=$IHE_GW_URL_INBOUND
        fi
    else
        IHE_GW_URL=$IHE_GW_URL_OUTBOUND
    fi
fi
