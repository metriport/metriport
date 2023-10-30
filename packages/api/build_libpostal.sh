#!/usr/bin/env bash
./bootstrap.sh
mkdir -p /opt/libpostal_data
./configure --datadir=/opt/libpostal_data --disable-sse2
make
make install
ldconfig