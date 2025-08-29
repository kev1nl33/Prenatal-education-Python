# api/state.py
# A simple in-memory store for sharing data between API handlers.
from collections import deque

# Use a deque with maxlen=1 to always store only the last item.
# This is thread-safe for single-item assignment in CPython.
LAST_TTS_DEBUG_INFO = deque(maxlen=1)
