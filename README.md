# Idk Virtual Machine

Idk-style virtual machine manager UI. This first version is configuration-only: it stores VM profiles locally in the browser and provides the interface that a future virtualization backend can connect to.

## Included
- Multiple VM profiles
- CPU, RAM, disk, ISO, networking, display, and sound configuration
- Start/settings controls prepared for a future backend
- Storage area
- Responsive Idk-style interface

## Planned backend
QEMU/KVM or another supported virtualization engine can later be connected through a secure API for real VM lifecycle, storage, ISO, networking, display, and audio controls.
