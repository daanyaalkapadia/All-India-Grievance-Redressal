const   express                 = require('express'),
        router                  = express.Router(),
        firebase                = require('firebase'),
        { ensureAuthenticated } = require('../config/auth');

var datab = firebase.database();
var ref = datab.ref("/user");

const User = require('../models/User')

router.get('/', (req,res) => res.redirect('/users/login'));

var totalcount=0;
var totalredressed=0;
var totalpending=0;
var totalusers=0;
var userArray=[];
var userSubArray=[];

//Dashboard Route
router.get('/dashboard',ensureAuthenticated,function(req,res){
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                totalusers=totalusers+1;
                userSubArray.push(allUsers[user].fname);
                userSubArray.push(allUsers[user].state);
                userSubArray.push(allUsers[user].mobile);
                userSubArray.push(allUsers[user].email);
                userArray.push(userSubArray);
                userSubArray=[];
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        totalcount=totalcount+1;
                        if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                            totalredressed=totalredressed+1;
                        }
                        if((allUsers[user].complaints[complaint].status == "Complaint Not Solved") || (allUsers[user].complaints[complaint].status == "Complaint Partially Solved")){
                            totalpending=totalpending+1;
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].state == req.user.state){
                    totalusers=totalusers+1;
                    userSubArray.push(allUsers[user].fname);
                    userSubArray.push(allUsers[user].city);
                    userSubArray.push(allUsers[user].mobile);
                    userSubArray.push(allUsers[user].email);
                    userArray.push(userSubArray);
                    userSubArray=[];
                }
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].state == req.user.state)
                        {
                            totalcount=totalcount+1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totalredressed=totalredressed+1;
                            }
                            if((allUsers[user].complaints[complaint].status == "Complaint Not Solved") || (allUsers[user].complaints[complaint].status == "Complaint Partially Solved")){
                                totalpending=totalpending+1;
                            }
                        }
                    });
                }
            });
        }
        User.find().exec().then(function(numItems) {
            res.render("dashboard.ejs",{name: req.user.name, state: req.user.state,
                totalcount: totalcount, totalredressed:totalredressed, totalpending:totalpending ,totalusers:totalusers,
                tableData:numItems, userArray:userArray});
                totalredressed=0;
                totalusers=0;
                totalcount=0;
                totalpending=0;
                userArray=[];
        }); 
    });
});

//To display Admin list in new page
router.get('/adminlist',ensureAuthenticated,function(req,res){
    User.find().exec().then(function(numItems) {
        res.render("adminlist.ejs",{name: req.user.name, state: req.user.state,tableData : numItems});
    });
});

//UserList
router.get('/userlist',ensureAuthenticated,function(req,res){
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                totalusers=totalusers+1;
                userSubArray.push(allUsers[user].fname);
                userSubArray.push(allUsers[user].state);
                userSubArray.push(allUsers[user].mobile);
                userSubArray.push(allUsers[user].email);
                userArray.push(userSubArray);
                userSubArray=[];
                
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].state == req.user.state){
                    totalusers=totalusers+1;
                    userSubArray.push(allUsers[user].fname);
                    userSubArray.push(allUsers[user].city);
                    userSubArray.push(allUsers[user].mobile);
                    userSubArray.push(allUsers[user].email);
                    userArray.push(userSubArray);
                    userSubArray=[];
                }
            });
        }
        res.render("userlist.ejs",{name: req.user.name, state: req.user.state, userArray:userArray});
        userArray=[]; 
    });
});

module.exports = router;