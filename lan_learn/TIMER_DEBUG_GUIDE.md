# Timer Debugging Guide

## Issue Fixed: Timer showing endTime as null

### What Was Wrong
The timer was being cleared incorrectly, setting `endTime` to `null` which caused the timer checks to fail.

### What Was Fixed
1. **Added validation in `startTimer()`** - Now checks if `endTime` is set before starting
2. **Improved logging** - Better console logs to track timer state
3. **Fixed `clearTimer()`** - No longer sets `endTime` to `null` (only clears the interval)
4. **Fixed `clearSession()`** - Only clears `endTime` when completely ending the session
5. **Added session restoration logging** - Better visibility into session restore process

## How to Test

### Quick 30-Second Test
1. Open browser console (F12)
2. Click "Start Learning"
3. In the time popup:
   - Start time: (auto-filled with current time)
   - End time: Set to **30 seconds from now**
   - Example: If it's 10:30:00, set end time to 10:30:30
4. Click "Start Session"

### What You Should See in Console

```
=== Starting New Session ===
Start time: Fri Feb 06 2026 10:30:00 GMT+0530
End time: Fri Feb 06 2026 10:30:30 GMT+0530
Current time: Fri Feb 06 2026 10:30:00 GMT+0530
Duration: 30 seconds
this.endTime set to: Fri Feb 06 2026 10:30:30 GMT+0530
Saved to localStorage: 2026-02-06T05:00:30.000Z
Starting session timer. End time: Fri Feb 06 2026 10:30:30 GMT+0530

Timer check - Now: 10:30:01 End: 10:30:30 Remaining: 29 seconds
Timer check - Now: 10:30:02 End: 10:30:30 Remaining: 28 seconds
Timer check - Now: 10:30:03 End: 10:30:30 Remaining: 27 seconds
...
Timer check - Now: 10:30:29 End: 10:30:30 Remaining: 1 seconds
Timer check - Now: 10:30:30 End: 10:30:30 Remaining: 0 seconds
⏰ Session time reached! Ending session...
Ending learning session...
Clearing timer...
Playing beep sound...
```

### What You Should Experience

1. **At 30 seconds:**
   - ✅ Hear 3 beep sounds (beep... beep... beep...)
   - ✅ See popup: "⏰ Time Ended" with message "Time is ended. Time is ended."
   - ✅ Conversation stops automatically

2. **Click OK:**
   - ✅ Returns to home page
   - ✅ Session data cleared

## Console Commands for Manual Testing

### Check Current Session State
```javascript
// Check if timer is running
console.log('Timer interval:', window.learnHomeInstance.timerInterval);
console.log('End time:', window.learnHomeInstance.endTime);
console.log('Session ended:', window.learnHomeInstance.sessionEnded);

// Check localStorage
console.log('Stored end time:', localStorage.getItem('learningSessionEndTime'));
console.log('Session ended flag:', localStorage.getItem('learningSessionEnded'));
```

### Manually Trigger Session End (for testing)
```javascript
// Set end time to 5 seconds from now
const now = new Date();
const endTime = new Date(now.getTime() + 5000);
window.learnHomeInstance.endTime = endTime;
localStorage.setItem('learningSessionEndTime', endTime.toISOString());
console.log('End time set to 5 seconds from now');
```

### Clear Session Manually
```javascript
window.learnHomeInstance.clearSession();
console.log('Session cleared');
```

## Troubleshooting

### Problem: Timer shows "End: null"
**Solution:** This is now fixed. The timer validates `endTime` before starting.

### Problem: No beep sound
**Possible causes:**
1. Browser audio is muted
2. Browser requires user interaction before playing audio
3. AudioContext not supported

**Solution:**
- Check browser volume
- Try clicking on the page first (user interaction)
- Check browser console for audio errors

### Problem: Popup doesn't appear
**Check:**
1. Console for errors
2. `timeEndedShown` flag: `console.log(window.learnHomeInstance.timeEndedShown)`
3. Popup element exists: `console.log(document.getElementById('time-ended-popup'))`

**Solution:**
```javascript
// Manually show popup for testing
Utils.showPopup('time-ended-popup');
```

### Problem: Timer doesn't restore after refresh
**Check localStorage:**
```javascript
console.log('Stored end time:', localStorage.getItem('learningSessionEndTime'));
console.log('Session ended:', localStorage.getItem('learningSessionEnded'));
```

**Solution:**
- Clear localStorage and start fresh:
```javascript
localStorage.removeItem('learningSessionEndTime');
localStorage.removeItem('learningSessionEnded');
location.reload();
```

## Expected Console Output (Complete Flow)

### 1. Starting Session
```
=== Starting New Session ===
Start time: Fri Feb 06 2026 10:30:00 GMT+0530
End time: Fri Feb 06 2026 10:30:30 GMT+0530
Current time: Fri Feb 06 2026 10:30:00 GMT+0530
Duration: 30 seconds
this.endTime set to: Fri Feb 06 2026 10:30:30 GMT+0530
Saved to localStorage: 2026-02-06T05:00:30.000Z
Starting session timer. End time: Fri Feb 06 2026 10:30:30 GMT+0530
```

### 2. Timer Running
```
Timer check - Now: 10:30:01 End: 10:30:30 Remaining: 29 seconds
Timer check - Now: 10:30:02 End: 10:30:30 Remaining: 28 seconds
...
```

### 3. Session Ending
```
Timer check - Now: 10:30:30 End: 10:30:30 Remaining: 0 seconds
⏰ Session time reached! Ending session...
Ending learning session...
Clearing timer...
Playing beep sound...
Audio context created: [AudioContext object]
Beep sounds scheduled
Single beep played at delay: 0
Single beep played at delay: 600
Single beep played at delay: 1200
```

### 4. After Clicking OK
```
Clearing session completely
```

## Key Code Sections

### Timer Start (learn-home.js:368)
```javascript
startTimer() {
    if (!this.endTime) {
        console.error('Cannot start timer: endTime is not set');
        return;
    }
    // ... timer logic
}
```

### Timer Check (learn-home.js:380)
```javascript
if (now >= this.endTime && !this.sessionEnded) {
    console.log('⏰ Session time reached! Ending session...');
    this.sessionEnded = true;
    this.endSession();
}
```

### Session End (learn-home.js:410)
```javascript
endSession() {
    localStorage.setItem('learningSessionEnded', 'true');
    this.clearTimer();
    this.playBeepSound();
    if (window.dialoguePage) {
        window.dialoguePage.stopAutoAdvance?.();
    }
    if (!this.timeEndedShown) {
        this.timeEndedShown = true;
        setTimeout(() => {
            Utils.showPopup('time-ended-popup');
        }, 500);
    }
}
```

## Success Criteria

✅ Console shows "Starting session timer. End time: [valid date]" (not null)
✅ Console shows countdown: "Remaining: X seconds"
✅ At 0 seconds: "⏰ Session time reached!"
✅ Beep sounds play (3 times)
✅ Popup appears with correct message
✅ Conversation stops
✅ OK button returns to home
✅ Session data clears

## If Still Not Working

1. **Clear browser cache and reload**
2. **Check browser console for JavaScript errors**
3. **Verify all files are saved**
4. **Try in incognito/private mode**
5. **Test in different browser**

## Contact/Support

If issues persist, provide:
1. Browser name and version
2. Complete console output
3. Steps to reproduce
4. Screenshots of the issue

