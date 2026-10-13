"""Lightweight policy helpers; no GPU imports needed for tests."""
import re

def acquire_speech_lock(lock,cancel):
    while not (cancel and cancel.is_set()):
        if lock.acquire(timeout=.05):return True
    return False

def token_budget(text):
    # Approximately 25 speech tokens/second, with generous pronunciation and
    # pause allowance. Prevent a short sentence running to the old 1000 cap.
    words=len(re.findall(r'\S+',text))
    return min(650,max(220,100+words*28))
