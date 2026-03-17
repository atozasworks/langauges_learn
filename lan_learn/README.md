# GTongue Learn - Standalone Language Learning Platform

A standalone language learning application extracted from the GTongue project, built with plain HTML, CSS, JavaScript, and a Node.js + MongoDB backend.

## Backend Migration Status

- XAMPP/PHP backend is replaced by a Node.js server (`server.js`).
- MongoDB Compass is the primary database via `MONGODB_URI` and `MONGODB_DB`.
- Existing frontend endpoint paths (for example `auth-backend/send-otp.php`) are now served by Node routes for compatibility.

## Features

- **Learner Management**: Add, select, and manage learners
- **Interactive Dialogues**: Practice conversations with personalized learner names
- **Multi-language Translation**: Translate the entire application to 30+ languages using Google Translate
- **Navigation**: Navigate through conversations and individual lines
- **Responsive Design**: Works on desktop and mobile devices
- **Local Storage**: Persists learner data locally in the browser
- **Modern UI**: Clean and intuitive user interface
- **Translation Caching**: Efficient translation system with caching for better performance

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB running locally or remotely (MongoDB Compass URI)
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone or download this project.
2. In `AtoZ_Services/lan_learn`, install dependencies:

```bash
npm install
```

This also runs `postinstall` to repair/build `atozas-auth-kit-express` and `atozas-react-auth-kit` if their `dist` output is missing.

3. Create your environment file:

```bash
cp .env.example .env
```

4. Update `.env` with your MongoDB Compass connection:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=lldb
```

5. Start the full app (frontend + API) with Node:

```bash
npm run build:auth-ui
npm run dev
```

6. Open `http://localhost:3000` in your browser.

### Usage

1. **Add Learners**: Enter learner names on the home page
2. **Select Learners**: Check the boxes next to learners you want to include
3. **Choose Language**: Select your preferred language from the dropdown in the navigation
4. **Start Learning**: Click "Start Learning" to begin the dialogue
5. **Navigate**: Use the buttons to move through conversations and lines

### Translation Features

The application supports automatic translation to 30+ languages:

- **Language Selection**: Use the language dropdown in the navigation bar
- **Auto-Translation**: The entire interface and dialogues are translated automatically
- **Persistent Selection**: Your language preference is saved locally
- **Real-time Translation**: Change languages anytime during use

**Supported Languages**:
English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese (Simplified & Traditional), Arabic, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Thai, Vietnamese, Turkish, Polish, Dutch, Swedish, Danish, Norwegian, Finnish

## File Structure

```
llearn/
├── index.html                 # Main HTML file
├── styles/
│   ├── style.css             # Main styles and navigation
│   ├── learn-home.css        # Home page styles
│   └── dialogue.css          # Dialogue page styles
├── js/
│   ├── app.js                     # Main application logic
│   ├── learn-home.js              # Home page functionality
│   ├── dialogue-data.js           # Embedded dialogue content
│   ├── dialogue.js                # Dialogue page functionality
│   ├── translation-service.js     # Google Translate integration
│   ├── api-translation-demo.js    # Premium API translation demo
│   └── utils.js                   # Utility functions
├── assets/
│   └── languageScripts/
│       └── English.txt       # English dialogue scripts
└── README.md                 # This file
```

## Adding New Languages

To add support for new languages:

**Method 1: Embedded Data (Recommended)**
1. Open `js/dialogue-data.js`
2. Add a new language entry to the `DialogueData` object:
   ```javascript
   const DialogueData = {
       English: `...existing content...`,
       Spanish: `Your Spanish dialogue content here...`,
       French: `Your French dialogue content here...`,
   };
   ```
3. Follow the same dialogue format as the English content

**Method 2: External Files (Requires Server)**
1. Create a new text file in `assets/languageScripts/` (e.g., `Spanish.txt`)
2. Format the dialogue following the same pattern as `English.txt`
3. Modify `dialogue.js` to use fetch() instead of embedded data
4. Run the application with a local server

### Dialogue Format

```
Basic Introduction and Greetings

Conversation 1
Person 1: Hello! How are you?
Person 2: I'm fine, thank you. And you?
Person 3: I'm doing great!

Conversation 2
Person 1: Good morning! Had breakfast?
Person 2: Yes, I had cereal. You?
```

## Features Explained

### Learner Management
- Add learners with name validation
- Select multiple learners for sessions
- Delete learners with confirmation
- Persistent storage using localStorage

### Dialogue System
- Dynamic name replacement in conversations
- Conversation navigation
- Line-by-line progression
- Highlighted current line
- Responsive design for all devices

### Translation System
The application includes two translation approaches:

**1. Google Translate Widget (Free - Default)**
- Automatic page translation using Google Translate Widget
- No API key required
- Translates the entire page interface
- Simple to use and maintain

**2. Google Translate API (Premium - Optional)**
- Direct API integration for more control
- Requires Google Cloud API key
- Batch translation for better performance
- Caching system to reduce API calls
- Language detection capabilities

### Data Persistence
- Learners, OTP records, and login audit records are stored in MongoDB.
- Learner selections and UI preferences are still stored in browser localStorage/sessionStorage.

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Backend Configuration

### Required

- `MONGODB_URI`: MongoDB connection string (Compass-compatible)
- `MONGODB_DB`: Database name
- `JWT_SECRET`: JWT secret for access tokens
- `JWT_REFRESH_SECRET`: JWT secret for refresh tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (required in production)

### Auth Architecture

- Backend auth is powered by `atozas-auth-kit-express` mounted at `/api/auth`.
- Frontend auth UI uses production-ready React components from `atozas-react-auth-kit` bundled into `frontend/dist/auth-modal.js`.
- Access tokens are sent as Bearer tokens; refresh tokens are stored in HTTP-only cookies.
- Secure learner CRUD endpoints are protected and use authenticated user identity:
   - `GET /api/secure/learners`
   - `POST /api/secure/learners`
   - `DELETE /api/secure/learners/:learnerId`
- Legacy endpoints (`/api/get-learners`, `/api/add-learner`, `/api/delete-learner`) remain for backward compatibility.

### Optional (OTP Email)

- `SMTP_SERVER`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `SMTP_NAME`
- If SMTP is not configured in development mode, OTP is generated and logged by the Node server.

## Advanced Setup (Optional)

### Setting up Google Translate API (Premium Features)

For advanced translation features, you can configure the Google Translate API:

1. **Get an API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Translate API
   - Go to Credentials and create an API key
   - Copy the API key

2. **Configure the Application**:
   ```javascript
   // In the browser console or modify translation-service.js
   if (window.app && window.app.translationService) {
       window.app.translationService.setApiKey('YOUR_API_KEY_HERE');
   }
   ```

3. **Benefits of API Integration**:
   - Better translation accuracy
   - Batch processing capabilities
   - Language detection
   - Translation caching
   - Usage analytics

**Note**: Google Translate API is a paid service. Check [pricing](https://cloud.google.com/translate/pricing) for details.

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox and grid
- **JavaScript ES6+**: Modern JavaScript features
- **jQuery**: For DataTables functionality
- **DataTables**: Advanced table features
- **Lucide Icons**: Beautiful icon set
- **Google Translate**: Translation services

## Contributing

This is a standalone version extracted from the larger GTongue project. To contribute:

1. Fork the repository
2. Make your changes
3. Test thoroughly across different browsers
4. Submit a pull request

## License

This project is part of the GTongue ecosystem. Please refer to the main project for licensing information.

## Original Project

This is a standalone extraction of the Learn section from GTongue - The Global Tongue project. 
Visit the main project: [GTongue GitHub Repository](https://github.com/atozats/GLearn.git)

## Acknowledgments

- Original GTongue development team
- Contributors to the language learning dialogue scripts
- Open source libraries used in this project

## Support

For support, please:
1. Check the browser console for error messages
2. Ensure JavaScript is enabled
3. Try refreshing the page
4. Clear browser cache if needed

---

**Breaking Language Barriers, Uniting the World!** 