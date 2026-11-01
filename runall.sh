#!/bin/bash
cd "$(dirname "$0")"
for t in T9 T10 T11 R6 R7 R1 R4 R10 R11 R9; do python3 harness.py "$1" "$2" $t; done
