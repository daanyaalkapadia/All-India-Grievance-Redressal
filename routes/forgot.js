const   express     = require('express'),
        router      = express.Router(),
        mongoose    = require('mongoose'),
        bcrypt      = require('bcryptjs'),
        nodemailer  = require("nodemailer"),
        { google }  = require("googleapis"),
        OAuth2      = google.auth.OAuth2;

//User model
const User = require('../models/User')

const oauth2Client = new OAuth2(
    "", // ClientID
    "", // Client Secret
    "" // Redirect URL
);

oauth2Client.setCredentials({
    refresh_token: ""
});

const accessToken = oauth2Client.getAccessToken()

const smtpTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
         type: "OAuth2",
         user: "allindiagrievanceredressalapp@gmail.com", 
         clientId: "",
         clientSecret: "",
         refreshToken: "",
         accessToken: accessToken
    }
});

router.get('/forgot',function(req,res){
    res.render('forgot.ejs',{msg: ""});
});

function getRandomNumber(){
    return String(Math.floor(10000000+Math.random()*90000000));
 }

router.post('/forgot',function(req,res){
    const email = req.body.email;
    User.findOne({email:email},function(err,user){
        if(err){ res.redirect('/forgot'); }
        if(!user){
            res.render("forgot.ejs",{msg:"Invalid Email"});
        }
        if(user){
            var otp=getRandomNumber();
            var body = "Hi <b>" + user.name + ",<br></b>" +
                "Following is the OTP to reset your password of All India Grievance Redressal App account related to this id "+
                user.email + "<br><b><h1>"+
                otp+"</h1></b><br>"+
                "<h3>Valid for 5 Minutes</h3>"+
                "If you didnt ask for resetting your password then please ignore this mail.<br><br>"+
                "Thanks,<br> Team All India Grievance Redressal App"
            const mailOptions = {
                from: "allindiagrievanceredressalapp@gmail.com",
                to: email,
                subject: "Password Reset of All India Grievance Redressal App",
                generateTextFromHTML: true,
                html: body
            };
            smtpTransport.sendMail(mailOptions, (error, response) => {
                error ? console.log(error) : console.log(response);
                smtpTransport.close();
            });
            User.updateOne({email:email},{otp:otp, date:String(new Date()) },function(err,result){
                if(err){ console.log(err); }
                else { console.log(result); }
            });
            res.redirect('./reset');
        }
    });
});

router.get('/reset',function(req,res){
    res.render('reset.ejs',{msg:''});
});

router.post('/reset',function(req,res){
    const { otp, newpassword1,newpassword2} =req.body;
    User.findOne({otp:otp},function(err,user){
        if(!user){
            res.render('reset.ejs',{msg:"Invalid OTP"});
        }else{
            if(Math.round((new Date()-new Date(user.date))/1000) > 300){
                User.updateOne({email:user.email},{otp:'',date:''},function(err,result){});
                res.render('reset.ejs',{msg:"OTP Expired"});
            }else{
                if(newpassword1 === newpassword2){
                    if(newpassword1.length>=6){
                        bcrypt.hash(newpassword1, 10, function(err, hash) {
                            var myquery = { email: user.email };
                                var newvalues = {$set: {password: hash,otp:null,date: null} };
                                User.updateOne(myquery, newvalues, function(err, res) {
                                  if (err) throw err;
                                });
                                res.redirect('./users/login');
                        });
                    }else{
                        res.render('reset.ejs',{msg : "Password Not Updated!Password Should be atleast 6 character" });
                    }
    
                }else{
                    res.render('reset.ejs',{msg : "Password Not Updated! Both New Password not Matched" });
                }
            }
        }
    });
});

module.exports = router;