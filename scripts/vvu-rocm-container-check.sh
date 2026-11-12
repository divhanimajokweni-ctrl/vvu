#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: vvu-rocm-container-check.sh
# RELEASE: 2026-09-01 (v1.5.3 - Safety & Audit Refinement)
#
# ------------------------------------------------------------------------------
# ⚠️ SAFETY WARNING & AUDIT HEADER
# ------------------------------------------------------------------------------
# 1. THIS IS A DIAGNOSTIC AUDIT SCRIPT, NOT AN AUTOMATED SILENT INSTALLER.
# 2. DO NOT EXECUTE OR PASTE INSTALL COMMANDS INSIDE UNPRIVILEGED CONTAINERS.
# 3. REQUIRES A PHYSICAL HOST OR VM WITH DIRECT AMD GPU PASSTHROUGH (/dev/kfd).
# 4. ZERO DEPENDENCIES REQUIRED — USES PURE BASH STANDARD UTILITIES ONLY.
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}======================================================================${NC}"
echo -e "${BLUE}    VENTURE VISION UBUNTU (VVU) - AMD ROCm DRIVER & NODE AUDIT        ${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo "DATE: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "HOST: $(hostname)"
echo "KERNEL: $(uname -r)"
echo "----------------------------------------------------------------------"

# ------------------------------------------------------------------------------
# VERSION DRIFT NOTE (ROCm 6.4 Baseline vs Preview Releases)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}[VERSION DRIFT NOTE]${NC} Production target baseline is locked to ROCm 6.4 (Stable)."
echo "                    Preview references (ROCm 7.x / 7.10) represent future roadmap targets"
echo "                    and are NOT locked for current deployment. Do not update baseline until hardware is provisioned."
echo "----------------------------------------------------------------------"

HAS_GPU_NODES=false
HAS_ROCM_TOOLS=false
HAS_MODULES=false

# 1. Check Device Nodes & Container Environment
echo -e "\n[1/5] Inspecting Kernel & GPU Device Nodes..."
if [[ -c /dev/kfd ]] && ls /dev/dri/renderD* &>/dev/null; then
    echo -e "  [${GREEN}DETECTED${NC}] /dev/kfd and /dev/dri render nodes exist."
    HAS_GPU_NODES=true
else
    echo -e "  [${YELLOW}ABSENT${NC}] /dev/kfd or /dev/dri/renderD* nodes not found."
fi

# ------------------------------------------------------------------------------
# CONTAINER DETECT & BAIL-OUT WARNING
# ------------------------------------------------------------------------------
IS_CONTAINER=false
if [[ -f /.dockerenv ]] || [[ -f /run/.containerenv ]] || grep -q -i "gvisor\|docker\|containerd\|podman" /proc/1/cgroup 2>/dev/null || uname -r | grep -q "gvisor"; then
    IS_CONTAINER=true
fi

if [[ "$HAS_GPU_NODES" == false ]] && [[ "$IS_CONTAINER" == true ]]; then
    echo -e "\n  ${RED}====================================================================${NC}"
    echo -e "  ${RED} 🛑 [CONTAINER BAIL-OUT WARNING]${NC}"
    echo -e "  ${RED}    Running inside a container/sandbox without physical GPU passthrough.${NC}"
    echo -e "  ${RED}    ROCm hardware acceleration CANNOT function in this environment.${NC}"
    echo -e "  ${RED}    The installation steps below are for PHYSICAL HOST REFERENCE ONLY.${NC}"
    echo -e "  ${RED}====================================================================${NC}"
fi

# ------------------------------------------------------------------------------
# INSTALLED ROCm VERSION DETECTION
# ------------------------------------------------------------------------------
echo -e "\n[2/5] Inspecting Installed ROCm Version..."
INSTALLED_ROCM_VER="None / Not Installed"

if [[ -f /opt/rocm/.info/version ]]; then
    INSTALLED_ROCM_VER=$(cat /opt/rocm/.info/version)
elif command -v hipconfig &>/dev/null; then
    INSTALLED_ROCM_VER=$(hipconfig --version 2>/dev/null || echo "Unknown")
elif command -v rocminfo &>/dev/null; then
    INSTALLED_ROCM_VER=$(rocminfo | grep -i "ROCm Version" | head -n 1 | awk '{print $NF}' || echo "Detected (rocminfo present)")
fi

if [[ "$INSTALLED_ROCM_VER" != "None / Not Installed" ]]; then
    echo -e "  [${GREEN}VERSION DETECTED${NC}] Installed ROCm Version: ${INSTALLED_ROCM_VER}"
else
    echo -e "  [${YELLOW}NOT FOUND${NC}] No installed ROCm version detected at /opt/rocm or via hipconfig."
fi

# 3. Check ROCm CLI Tools
echo -e "\n[3/5] Inspecting ROCm Management Utilities..."
if command -v rocminfo &>/dev/null; then
    echo -e "  [${GREEN}DETECTED${NC}] rocminfo available at $(which rocminfo)"
    HAS_ROCM_TOOLS=true
    rocminfo | grep -E "Name:|Marketing Name|Compute Unit" | head -n 10 || true
elif command -v amd-smi &>/dev/null; then
    echo -e "  [${GREEN}DETECTED${NC}] amd-smi available at $(which amd-smi)"
    HAS_ROCM_TOOLS=true
    amd-smi || true
else
    echo -e "  [${YELLOW}ABSENT${NC}] rocminfo and amd-smi CLI utilities not found."
fi

# 4. Check Kernel Modules
echo -e "\n[4/5] Checking Kernel Module Status..."
if lsmod 2>/dev/null | grep -E "amdgpu|kfd" &>/dev/null; then
    echo -e "  [${GREEN}LOADED${NC}] amdgpu / kfd kernel modules active."
    HAS_MODULES=true
else
    echo -e "  [${YELLOW}ABSENT${NC}] amdgpu / kfd kernel modules not loaded."
fi

# 5. Driver & Tool Installation Reference Flow
echo -e "\n[5/5] Evaluating Driver Installation Requirements..."

if [[ "$HAS_GPU_NODES" == true ]] && [[ "$HAS_ROCM_TOOLS" == true ]]; then
    echo -e "  [${GREEN}SUCCESS${NC}] AMD ROCm driver stack is fully operational."
    exit 0
fi

echo -e "  [${RED}INCOMPLETE${NC}] ROCm environment incomplete. Host reference guide below:"

# Detect OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS_NAME="${ID:-unknown}"
    OS_VER="${VERSION_ID:-unknown}"
    CODENAME="${UBUNTU_CODENAME:-noble}"
else
    OS_NAME="unknown"
    OS_VER="unknown"
    CODENAME="noble"
fi

echo "  Target OS Platform: $OS_NAME ($OS_VER)"

if command -v apt-get &>/dev/null || [[ "$OS_NAME" == "ubuntu" ]] || [[ "$OS_NAME" == "debian" ]]; then
    echo -e "\n  ---> Recommended Ubuntu/Debian Installation Procedure (PHYSICAL HOST ONLY):"
    echo "       1. wget https://repo.radeon.com/amdgpu-install/6.4/ubuntu/$CODENAME/amdgpu-install_6.4.60400-1_all.deb"
    echo "       2. sudo apt-get update && sudo apt-get install -y ./amdgpu-install_*.deb"
    echo "       3. sudo amdgpu-install --usecase=rocm,hiplibsdk --no-dkms"
    echo "       4. sudo usermod -aG render,video \$USER"
elif command -v dnf &>/dev/null || [[ "$OS_NAME" == "rhel" ]] || [[ "$OS_NAME" == "rocky" ]]; then
    echo -e "\n  ---> Recommended RHEL/Rocky Linux Installation Procedure (PHYSICAL HOST ONLY):"
    echo "       1. sudo dnf install -y https://repo.radeon.com/amdgpu-install/6.4/rhel/$OS_VER/amdgpu-install-6.4.60400-1.el$OS_VER.noarch.rpm"
    echo "       2. sudo amdgpu-install --usecase=rocm,hiplibsdk"
    echo "       3. sudo usermod -aG render,video \$USER"
else
    echo -e "\n  ---> Generic Manual Setup Instructions:"
    echo "       Follow official AMD ROCm documentation: https://rocm.docs.amd.com/"
fi

# Final Notice
echo -e "\n  [${YELLOW}NOTICE${NC}] Local container sandbox is air-gapped without physical GPU hardware."
echo "           Do NOT attempt to execute installer commands inside this container."
echo "           To run ROCm acceleration, execute this script on a physical host with an AMD GPU."

echo -e "\n----------------------------------------------------------------------"
echo -e "AUDIT COMPLETE: Script ready for deployment on physical AMD Instinct/Radeon nodes."
echo -e "----------------------------------------------------------------------"
