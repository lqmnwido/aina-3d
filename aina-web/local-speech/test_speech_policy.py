import unittest
import threading
from speech_policy import token_budget,acquire_speech_lock

class SpeechPolicyTests(unittest.TestCase):
    def test_short_reply_has_bounded_budget(self):
        self.assertEqual(token_budget('Satu tambah satu adalah dua.'),240)
    def test_long_text_never_exceeds_safety_cap(self):
        self.assertEqual(token_budget('perkataan '*1000),650)
    def test_short_minimum_preserves_pause_allowance(self):
        self.assertEqual(token_budget('Hi!'),220)
    def test_cancelled_request_never_enters_queue(self):
        lock=threading.Lock();cancel=threading.Event();cancel.set()
        self.assertFalse(acquire_speech_lock(lock,cancel))
        self.assertFalse(lock.locked())
    def test_waiting_request_cancels_without_waiting_for_active_speech(self):
        lock=threading.Lock();lock.acquire();cancel=threading.Event()
        timer=threading.Timer(.02,cancel.set);timer.start()
        try:self.assertFalse(acquire_speech_lock(lock,cancel))
        finally:timer.join();lock.release()

if __name__=='__main__':unittest.main()
