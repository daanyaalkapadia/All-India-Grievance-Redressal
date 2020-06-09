const   bcrypt          = require('bcryptjs'),
        mongoose        = require('mongoose'),
        LocalStrategy   = require('passport-local');


//Load User Model
const User = require('../models/User');

module.exports  = function(passport){
    passport.use(
        new LocalStrategy({ usernameField : 'email'}, (email,password,done) => {
            //Match User
            User.findOne({ email:email })
                .then(user =>{
                    if(!user){
                        return done(null,false, { message: 'Email doesnt exist' });
                    }
                    //Match Password
                    bcrypt.compare(password,user.password, (err,isMatch) =>{
                        if(err) throw err;
                        
                        if(isMatch){
                            return done(null,user);
                        }else{
                            return done(null,false, { message:'Password doesnt match' });
                        }
                    })
                }).catch(err => console.log(err));
        })
    );
    passport.serializeUser((user, done) => {
        done(null, user.id);
      });
    passport.deserializeUser((id, done) => {
        User.findById(id, (err, user) =>{
            done(err, user);
        });
    });
}