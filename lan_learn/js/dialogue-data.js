// Dialogue Data - Language Scripts
// This file contains the dialogue content embedded directly to avoid file loading issues

const DialogueData = {
  English: `                       

Conversation 1 
Basic Introduction and Greetings
Person 1: Good morning! Had breakfast?
Person 2: Yes, had idli and chutney. You?
Person 3: I had dosa today.
Person 4: Same here. Nothing like hot dosa in the morning!


Conversation 2 
Basic Introduction and Greetings
Person 1: Hi, everyone! How are you all?
Person 2: Hey! I'm good. How about you?
Person 3: Hello! I'm fine too.
Person 4: Hi! All good here. Long time no see!



Conversation 3 
Basic Introduction and Greetings
Person 1: Hello! Where are you from?
Person 2: I'm from Chennai. You?
Person 3: Bangalore here.
Person 4: I'm from Hyderabad. Nice to meet you all!



Conversation 4  
Basic Introduction and Greetings
Person 1: Hi! First time meeting you. What's your name?
Person 2: I'm Jhon. And you?
Person 1: I'm Alice. Nice to meet you!


Conversation 5  
Basic Introduction and Greetings
Person 2: Good evening! Where are you all headed?
Person 4: Just going for a walk. Care to join?
Person 5: Sounds good! Let's go.



Conversation 6 
Basic Introduction and Greetings
Person 1: Hello! How was your weekend?
Person 2: It was good. Went to the beach.
Person 3: I visited my grandparents.
Person 4: I just relaxed at home.



Conversation 7 
Basic Introduction and Greetings
Person 2: Hi! Did you watch the match yesterday?
Person 3: Oh yes! What a game!
Person 4: It was thrilling till the end.



Conversation 8 
Basic Introduction and Greetings
Person 1: Good afternoon! What's for lunch today?
Person 2: I brought curd rice. You?
Person 3: Lemon rice for me.
Person 4: I got tamarind rice.



Conversation 9 
Basic Introduction and Greetings
Person 3: Hey! How's work going?
Person 4: Busy, but manageable. How about you?
Person 1: Same here. Deadlines everywhere!



Conversation 10  
Basic Introduction and Greetings
Person 1: Hello! Are you from around here?
Person 2: Yes, I live nearby.
Person 3: I moved here recently.
Person 4: I visit often but live in a different city.




`,

  // You can add more languages here in the future
  // Spanish: `Spanish dialogue content here...`,
  // French: `French dialogue content here...`,
};

// Helper function to get dialogue for a specific language
const getDialogueForLanguage = (language) => {
  return DialogueData[language] || null;
};

// List of available languages
const getAvailableLanguages = () => {
  return Object.keys(DialogueData);
};

// Helper function to parse conversations for a specific language
const parseConversations = (language) => {
  const raw = DialogueData[language] || "";
  const conversations = [];
  const parts = raw.split(/\n\s*\n/).filter(Boolean);
  let currentHeading = [];
  let currentLines = [];
  let inDialogue = false;
  parts.forEach((part) => {
    const lines = part
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length && /^Conversation\s*\d+/i.test(lines[0])) {
      // If there is a previous conversation, push it
      if (currentHeading.length && currentLines.length) {
        conversations.push({
          heading: currentHeading.join(" "),
          lines: currentLines,
        });
      }
      // Start new conversation
      currentHeading = [];
      currentLines = [];
      inDialogue = false;
      // Collect heading lines (after Conversation X, before first Person)
      for (let i = 1; i < lines.length; i++) {
        if (/^Person\s*\d+:/i.test(lines[i])) {
          inDialogue = true;
          currentLines.push(lines[i].replace(/^Person\s*\d+:/i, "").trim());
        } else if (!inDialogue) {
          // Only push heading lines that are not empty and not 'Conversation...'
          if (!/^Conversation\s*\d+/i.test(lines[i]) && lines[i] !== "") {
            currentHeading.push(lines[i]);
          }
        }
      }
    } else if (currentHeading.length) {
      // Add dialogue lines, remove Person X: prefix
      lines.forEach((l) => {
        if (/^Person\s*\d+:/i.test(l)) {
          currentLines.push(l.replace(/^Person\s*\d+:/i, "").trim());
        }
      });
    }
  });
  // Push the last conversation
  if (currentHeading.length && currentLines.length) {
    conversations.push({
      heading: currentHeading.join(" "),
      lines: currentLines,
    });
  }
  return conversations;
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DialogueData,
    getDialogueForLanguage,
    getAvailableLanguages,
    parseConversations,
  };
}
