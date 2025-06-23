// Dialogue Data - Language Scripts
// This file contains the dialogue content embedded directly to avoid file loading issues

const DialogueData = {
    English: `                       

Conversation 1
Person 1: Good morning! Had breakfast?
Person 2: Yes, had idli and chutney. You?
Person 3: I had dosa today.
Person 4: Same here. Nothing like hot dosa in the morning!

Basic Introduction and Greetings
Conversation 2
Person 1: Hi, everyone! How are you all?
Person 2: Hey! I'm good. How about you?
Person 3: Hello! I'm fine too.
Person 4: Hi! All good here. Long time no see!


Basic Introduction and Greetings
Conversation 3
Person 1: Hello! Where are you from?
Person 2: I'm from Chennai. You?
Person 3: Bangalore here.
Person 4: I'm from Hyderabad. Nice to meet you all!


Basic Introduction and Greetings
Conversation 4
Person 1: Hi! First time meeting you. What's your name?
Person 2: I'm Jhon. And you?
Person 1: I'm Alice. Nice to meet you!


Basic Introduction and Greetings
Conversation 5
Person 2: Good evening! Where are you all headed?
Person 4: Just going for a walk. Care to join?
Person 5: Sounds good! Let's go.


Basic Introduction and Greetings
Conversation 6
Person 1: Hello! How was your weekend?
Person 2: It was good. Went to the beach.
Person 3: I visited my grandparents.
Person 4: I just relaxed at home.


Basic Introduction and Greetings
Conversation 7
Person 2: Hi! Did you watch the match yesterday?
Person 3: Oh yes! What a game!
Person 4: It was thrilling till the end.


Basic Introduction and Greetings
Conversation 8
Person 1: Good afternoon! What's for lunch today?
Person 2: I brought curd rice. You?
Person 3: Lemon rice for me.
Person 4: I got tamarind rice.


Basic Introduction and Greetings
Conversation 9
Person 3: Hey! How's work going?
Person 4: Busy, but manageable. How about you?
Person 1: Same here. Deadlines everywhere!


Basic Introduction and Greetings
Conversation 10
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DialogueData, getDialogueForLanguage, getAvailableLanguages };
} 