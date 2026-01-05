#!/bin/bash

# Release script for Browser SVG Editor
# This script handles version bumping, changelog updates, tagging, and pushing to main

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if we're on main branch
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: You must be on the main branch to release.${NC}"
    echo -e "Current branch: ${YELLOW}$CURRENT_BRANCH${NC}"
    echo "Please checkout main branch first:"
    echo "  git checkout main"
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes.${NC}"
    echo "Please commit or stash your changes before releasing."
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
echo -e "${BLUE}Current version: ${GREEN}$CURRENT_VERSION${NC}"

# Prompt for new version
echo -e "${YELLOW}Enter new version (format: MAJOR.MINOR.PATCH, e.g., 0.2.0):${NC}"
read -r NEW_VERSION

# Validate version format (MAJOR.MINOR.PATCH)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format. Please use MAJOR.MINOR.PATCH (e.g., 1.2.3)${NC}"
    exit 1
fi

# Check if version is actually new
if [ "$CURRENT_VERSION" == "$NEW_VERSION" ]; then
    echo -e "${RED}Error: New version must be different from current version.${NC}"
    exit 1
fi

# Determine version type for changelog
IFS='.' read -r -a CURRENT_PARTS <<< "$CURRENT_VERSION"
IFS='.' read -r -a NEW_PARTS <<< "$NEW_VERSION"

VERSION_TYPE="PATCH"
if [ "${NEW_PARTS[0]}" -gt "${CURRENT_PARTS[0]}" ]; then
    VERSION_TYPE="MAJOR"
elif [ "${NEW_PARTS[1]}" -gt "${CURRENT_PARTS[1]}" ]; then
    VERSION_TYPE="MINOR"
fi

echo -e "${BLUE}Version type: ${GREEN}$VERSION_TYPE${NC}"
echo -e "${BLUE}Updating from ${YELLOW}$CURRENT_VERSION${BLUE} to ${GREEN}$NEW_VERSION${NC}"

# Update package.json
echo -e "${YELLOW}Updating package.json...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

# Update CHANGELOG.md
echo -e "${YELLOW}Updating CHANGELOG.md...${NC}"
TODAY=$(date +%Y-%m-%d)

# Create changelog entry in a temporary file
TEMP_CHANGELOG=$(mktemp)
cat > "$TEMP_CHANGELOG" << EOF
## [$NEW_VERSION] - $TODAY

### Added
- 

### Changed
- 

### Fixed
- 

EOF

# Insert the new version entry after "## [Unreleased]"
TEMP_FILE=$(mktemp)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use sed to insert after the [Unreleased] line
    sed -i '' "/^## \[Unreleased\]/r $TEMP_CHANGELOG" CHANGELOG.md
    sed -i '' "/^## \[Unreleased\]/a\\
\\
" CHANGELOG.md
else
    # Linux
    sed -i "/^## \[Unreleased\]/r $TEMP_CHANGELOG" CHANGELOG.md
    sed -i "/^## \[Unreleased\]/a\\" CHANGELOG.md
fi
rm "$TEMP_CHANGELOG"

# Prompt for commit message
echo -e "${YELLOW}Enter release commit message (or press Enter for default):${NC}"
read -r COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Release version $NEW_VERSION"
fi

# Stage changes
echo -e "${YELLOW}Staging changes...${NC}"
git add package.json CHANGELOG.md

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "chore: $COMMIT_MSG

Version: $CURRENT_VERSION → $NEW_VERSION
Type: $VERSION_TYPE"

# Create git tag
echo -e "${YELLOW}Creating git tag v$NEW_VERSION...${NC}"
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# Show what will be pushed
echo ""
echo -e "${BLUE}Ready to push to main:${NC}"
echo -e "  - Commit: ${GREEN}$COMMIT_MSG${NC}"
echo -e "  - Tag: ${GREEN}v$NEW_VERSION${NC}"
echo ""

# Confirm before pushing
echo -e "${YELLOW}Push to main and create release tag? (y/n)${NC}"
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}Release cancelled. Changes are committed and tagged locally.${NC}"
    echo "To push manually later:"
    echo "  git push origin main"
    echo "  git push origin v$NEW_VERSION"
    exit 0
fi

# Push to main
echo -e "${YELLOW}Pushing to main...${NC}"
git push origin main

# Push tags
echo -e "${YELLOW}Pushing tags...${NC}"
git push origin "v$NEW_VERSION"

echo ""
echo -e "${GREEN}✅ Release successful!${NC}"
echo -e "${GREEN}Version $NEW_VERSION has been released.${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Go to GitHub → Releases → Draft a new release"
echo "2. Select tag: ${GREEN}v$NEW_VERSION${NC}"
echo "3. Copy content from CHANGELOG.md for release notes"
echo "4. Publish the release"

