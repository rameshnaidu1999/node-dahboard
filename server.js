const express = require('express');
const app = express();
const http = require('http').createServer(app);
const flash = require('connect-flash');
const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const ObjectId = mongodb.ObjectId;

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

var fs = require('fs'); 
var path = require('path'); 
var multer = require('multer'); 
const formidable = require("formidable");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const expressSession = require("express-session");
app.use(expressSession({
    "key": "user_id",
    "secret": "User secreat Object Id",
    "resave": true,
    "saveUninitialized": true
}));

// Connect flash
app.use(flash());

// Global Vars
app.use((req,res,next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});
app.use('/', express.static(__dirname + "/public"));
app.set('view engine', "ejs");

const postModel = require("./models/post")

var storage = multer.diskStorage({ 
    destination: (req, file, cb) => { 
        cb(null, 'uploads') 
    }, 
    filename: (req, file, cb) => { 
        cb(null, file.fieldname + '-' + Date.now()) 
    } 
}); 

var upload = multer({ storage: storage }); 

http.listen(3000,function(err){
    if(err) throw err;
    console.log("Server Started on Port 3000!");

    mongoClient.connect("mongodb+srv://Ramesh:ramesh123@cluster0-n5l8y.mongodb.net/test?retryWrites=true&w=majority",{useUnifiedTopology: true, useNewUrlParser: true}, function(err, client){
        var database = client.db("Esite");
        if(err) throw err;
        console.log("Databse connected to DB.");

        let errors = [];
        // Function to get User Document
        function getUser (id, callback){
            database.collection("users").findOne({
                "_id": ObjectId(id)
            }, function(error, user){
                callback(user)
            })
        }

        app.get('/', (req, res) => {
            database.collection("posts").find({}).sort({
                "createdAt": -1
            }).toArray(function(err, posts){
                res.render("main",{
                    "isLogin": req.session.user_id ? true : false,
                    "posts": posts
                })
            })
        });
    
        app.get('/login', (req, res) => {
            res.render("login");
        });
    
        app.get('/signup', (req, res) => {
            res.render("signup");
        });

        app.post('/signup', (req, res) => {
            database.collection("users").findOne({
                "email": req.body.email
            }, function(err, user){
                if(user == null){
                    //not exists
    
                    //hash password
                    bcrypt.hash(req.body.password, 10, function(err, hash){
                        database.collection("users").insertOne({
                            "name": req.body.name,
                            "email": req.body.email,
                            "password": hash,                           
                            "profileimage": "",
                            "followers": 0,
                            "following": [], // Channels I Subscribed
                            "posts": [],
                            "saved": [],
                            "notifications": []
                        }, function(err,data){
                            res.redirect("login");
                        })
                    })
                } else {
                    res.send("Email Laready Exists")
                }
            })
            
        });

        app.post('/login', (req, res) => {
            //email check
            database.collection("users").findOne({
                "email":req.body.email
            }, function(err,user){
                if(user == null){
                    res.send("Email Not exists")
                } else {
                    bcrypt.compare(req.body.password, user.password, function(err, isVerify){
                        if(isVerify){
                            //save user ID in Session
                            req.session.user_id = user._id;
                            res.redirect("/")
                        } else {
                            req.flash('error_msg', 'Incorrect credintials' )
                            res.render("login")
                        }
                    })
                }
            })
        });

        app.get('/uploadpost', (req, res) => {
            if(req.session.user_id){
                res.render("post", {
                    "isLogin": true
                },)
            } else {
                res.redirect("/login")
            }
        });

        app.post('/uploadpost', (req, res) => {
            // create upload page
            if(req.session.user_id){
                var formData = new formidable.IncomingForm();
                formData.parse(req, function(error, fields, files){
                    var caption = fields.caption;
                    var description = fields.desc;
                    var tags = fields.tags;

                    var oldPathThumbnail = files.thumbnail.path;
                    
                    var thumbnail = "/uploads/" + new Date().getTime() + "_" +files.thumbnail.name;
                    fs.rename(oldPathThumbnail, thumbnail, function(error){
                        // get user data to save in videos document
                        //var thumbnail = fs.readFileSync(path.join(__dirname + 'public/uploads/' +  new Date().getTime() + "_" + files.thumbnail.name)) 

                       // var data = fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename))
                        
                        getUser(req.session.user_id, function(user){
                            var currentTime = new Date().getTime();

                            //insert in databse
                            database.collection("posts").insertOne({
                                "user": {
                                    "_id": user._id,
                                    "name": user.name,
                                    "image": user.image,
                                    "followers": user.followers
                                },
                                "filePath": thumbnail,
                                "thumbnail": thumbnail,
                                "title": caption,
                                "description": description,
                                "tags": tags,
                                "createdAt": currentTime,
                                "views": 0,
                                "likers": [],
                                "comments": []
                            }, function(error, data){
                                // insert in user collection too

                                database.collection("users").updateOne({
                                    "_id": ObjectId(req.session.user_id)
                                },{
                                    $push: {
                                        "posts":{
                                            "_id": data.insertedId,
                                            "title": caption,
                                            "views": 0,
                                            "thumbnail": thumbnail,
                                            "watch": currentTime,
                                        }
                                    }
                                })
                                res.redirect("/");
                            })
                        
                        })
                    })
                })
            } else {
                res.redirect("/login")
            }
        });

        // app.post('/post', upload.single('image'), (req, res) => {
        //     var obj = { 
        //         name: req.body.caption, 
        //         desc: req.body.desc,
        //         tags: req.body.tags, 

        //         img: { 
        //             data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)), 
        //             contentType: 'image/jpg'
        //         } 
        //     } 
        //     postModel.create(obj, (err, item) => { 
        //         if (err) { 
        //             console.log(err); 
        //         } 
        //         else { 
        //             database.collection("posts").save(); 
        //             res.redirect('/'); 
        //         } 
        //     });
        // });
        app.get('/logout', (req, res) => {
            req.session.destroy();
            res.redirect("/login");
        });
    })
})