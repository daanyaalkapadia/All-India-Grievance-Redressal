const   express         = require('express'),
        mongoose        = require('mongoose'),
        passport        = require('passport'),
        flash           = require('connect-flash'),
        session         = require('express-session'),
        expressLayouts  = require('express-ejs-layouts');

const app   = express();

//Firebase Setup
var firebase = require('firebase');
var firebaseConfig = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

app.use(express.static("public"));

//Passport Config
require('./config/passport')(passport);

// DB config
const db = require('./config/keys').MongoURI;

//Connect to MongoDB
mongoose.connect(db,{useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Bodyparser
app.use(express.urlencoded({ extended:false }));    

//Express Session
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
}));

//Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

//EJS
app.use(expressLayouts);
app.set('view engine','ejs');

//Router
app.use('/',require('./routes/index'));
app.use('/',require('./routes/forgot'));
app.use('/users',require('./routes/users'));

// Common Route
app.get('*',function(req,res){
    res.render('login');
});

const PORT = process.env.PORT || 80

app.listen(PORT, console.log('Server Started!!!!'));