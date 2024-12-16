const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the "public" folder (where your HTML, CSS, JS files are located)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Append extension
    }
});

const upload = multer({ storage: storage });

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // replace with your MySQL username
    password: 'lewinsky2612', // replace with your MySQL password
    database: 'gallery_db'
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Dummy user for login (admin)
const ADMIN = {
    username: 'admin',
    password: 'password' // Change this to a secure password in production
};

// Secret key for JWT token
const SECRET_KEY = 'your_secret_key';

// Generate JWT token for authenticated users
function generateToken(username) {
    return jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
}

// Login endpoint for admin
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN.username && password === ADMIN.password) {
        const token = generateToken(username);
        return res.json({ message: 'Login successful', token });
    }
    
    return res.status(401).json({ message: 'Invalid credentials' });
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Failed to authenticate token' });
        }
        
        req.user = decoded;
        next();
    });
}

// Upload endpoint
app.post('/upload', verifyToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const filename = req.file.filename;

    // Insert image metadata into MySQL
    db.query('INSERT INTO images (filename) VALUES (?)', [filename], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        return res.json({ message: 'File uploaded successfully', filename });
    });
});

// Gallery endpoint
app.get('/gallery', (req, res) => {
    db.query('SELECT * FROM images', (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }
        res.json(results);
    });
});

// Download endpoint
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: 'File not found' });
    }
});

// Delete endpoint
app.delete('/delete/:id', verifyToken, (req, res) => {
    const imageId = req.params.id;

    // Delete image metadata from MySQL
    db.query('SELECT filename FROM images WHERE id = ?', [imageId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Image not found' });
        }

        const filename = results[0].filename;
        const filePath = path.join(__dirname, 'uploads', filename);

        // Delete the image file from disk
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete image metadata from database
        db.query('DELETE FROM images WHERE id = ?', [imageId], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to delete image', error: err });
            }

            res.json({ message: 'Image deleted successfully' });
        });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
