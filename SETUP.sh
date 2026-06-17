#!/bin/bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify
ollama --version

# Pull the lightest fast model
ollama pull llama3.2:3b

# Test it works
ollama run llama3.2:3b "hello"
