const   express                 = require('express'),
        router                  = express.Router(),
        url                     = require('url'),
        bcrypt                  = require('bcryptjs'),
        passport                = require('passport'),
        firebase                = require('firebase'),
        nodemailer              = require("nodemailer"),
        { google }              = require("googleapis"),
        OAuth2                  = google.auth.OAuth2,
        admin                   = require("firebase-admin"),
        { ensureAuthenticated } = require('../config/auth');

var datab = firebase.database();
var ref = datab.ref("/user");
var refWorkers = datab.ref("/Workers");

//User model
const User = require('../models/User')

//Includes for app notification
var serviceAccount = require("../all-india-grievance-app-privatek.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://all-india-grievance-app.firebaseio.com"
});

function sortAscending(arrObj){
	return arrObj.sort((a, b) => a.dateofcomplaint - b.dateofcomplaint);
}

function sortDescending(arrObj){
	return arrObj.sort((a, b) => b.dateofcomplaint - a.dateofcomplaint);
}

function toFormat(i,date)
{
	str=date.split(" ");
	date = str[1].split("-");
	day = Number(date[0]);
	month = Number(date[1]);
	year =  Number(date[2]);
	time = str[2].split(":");
	hr = Number(time[0]);
	min = Number(time[1]);
	sec = Number(time[2]);
	if(str[3] == "P.M." && hr!= 12){
		hr=Number(hr)+12;
	}
	if(str[3] == "A.M." && hr == 12){
		hr=Number(00);
	}
	arrObj[i].dateofcomplaint = new Date(year,month,day,hr,min,sec);
}

//Login
router.get('/login', (req,res) => res.render('login'));

//Login Handler
router.post('/login',(req,res,next)=>{
    passport.authenticate('local',{
        successRedirect:'/dashboard',
        failureRedirect:'/users/login'
    })(req,res,next)
});

//Logout Handler
router.get('/logout',(req,res)=>{
    req.logout();
    res.redirect('/users/login');
});

//Profile Route
router.get('/profile',ensureAuthenticated,function(req,res){
    res.render('profile.ejs',{name: req.user.name, state: req.user.state, email: req.user.email});
});

//Change Password Route
router.get('/profile/changePassword',ensureAuthenticated,function(req,res){
    res.render('changePassword.ejs',{ name: req.user.name, state: req.user.state, noupdate:'' });
});

//Change Password Handler
router.post('/profile/changing',ensureAuthenticated ,function(req,res){
    const {oldpassword,newpassword1, newpassword2} = req.body;
    bcrypt.compare(oldpassword, req.user.password, (err, isMatch) => {
        if(isMatch){
            if(newpassword1 === newpassword2){
                if(newpassword1.length>=6){
                    bcrypt.hash(newpassword1, 10, function(err, hash) {
                        var myquery = { email: req.user.email };
                            var newvalues = {$set: {password: hash} };
                            User.updateOne(myquery, newvalues, function(err, res) {
                              if (err) throw err;
                            });
                            res.redirect('/users/login');
                    });
                }else{
                    res.render('changePassword.ejs',
                        {name: req.user.name, state: req.user.state,
                        noupdate : "Password Not Updated!Password Should be atleast 6 character" });
                }

            }else{
                res.render('changePassword.ejs',
                {name: req.user.name, state: req.user.state,
                noupdate : "Password Not Updated! Both New Password not Matched" });
            }
        }else{
            res.render('changePassword.ejs',
            {name: req.user.name, state: req.user.state, noupdate : "Password Not Updated! Wrong Old Password" });
        }
    });
});

//Array two display Complaints
var arrObj=[];

//Pending Route
router.get("/pending",ensureAuthenticated,function (req,res) {
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        var q = url.parse(req.url, true);
        var qData = q.query;
        var order = qData.order;
        var count = 0;
        var sortedComplaints='';
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Not Solved"){
                            arrObj.push(allUsers[user].complaints[complaint]);
    						arrObj[count].user=allUsers[user];
	    					arrObj[count].userId=user;
		    				arrObj[count].complaintId=complaint;
			    			count++;
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Not Solved"){
                            if(allUsers[user].complaints[complaint].state == req.user.state)
                            {
                                arrObj.push(allUsers[user].complaints[complaint]);
    						    arrObj[count].user=allUsers[user];
	    					    arrObj[count].userId=user;
		    				    arrObj[count].complaintId=complaint;
			    			    count++;
                            }
                        }
                    });
                }
            });
        }
        //console.log(arrObj);
        for( var i=0 ; i < arrObj.length ; i++ ){
            toFormat(i,arrObj[i].dateofcomplaint);
        }
        if(order == 'ls'){
            sortedComplaints = sortAscending(arrObj);
        }else{
            sortedComplaints = sortDescending(arrObj);
        }
        res.render("pending.ejs",{array: sortedComplaints , name: req.user.name, state: req.user.state, flag : true});
        array=[];
        arrObj=[];
    });
});

//Pending Search
router.post("/searchpending",ensureAuthenticated,function (req,res) {
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        var count = 0;
        const {search} = req.body;
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Not Solved"){
                            if(isNaN(search)){
                                if(allUsers[user].complaints[complaint].c_type == search){
                                    arrObj.push(allUsers[user].complaints[complaint]);
                                    arrObj[count].user=allUsers[user];
                                    arrObj[count].userId=user;
                                    arrObj[count].complaintId=complaint;
                                    count++;
                                }
                            }else{
                                if(complaint === search){
                                    arrObj.push(allUsers[user].complaints[complaint]);
                                    arrObj[count].user=allUsers[user];
                                    arrObj[count].userId=user;
                                    arrObj[count].complaintId=complaint;
                                    count++;
                                }
                            }
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Not Solved"){
                            if(allUsers[user].complaints[complaint].state == req.user.state)
                            {
                                if(isNaN(search)){
                                    if(allUsers[user].complaints[complaint].c_type == search){
                                        arrObj.push(allUsers[user].complaints[complaint]);
                                        arrObj[count].user=allUsers[user];
                                        arrObj[count].userId=user;
                                        arrObj[count].complaintId=complaint;
                                        count++;
                                    }
                                }else{
                                    if(complaint === search){
                                        arrObj.push(allUsers[user].complaints[complaint]);
                                        arrObj[count].user=allUsers[user];
                                        arrObj[count].userId=user;
                                        arrObj[count].complaintId=complaint;
                                        count++;
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }
        for( var i=0 ; i < arrObj.length ; i++ ){
			toFormat(i,arrObj[i].dateofcomplaint);
        }
        sortedComplaints = sortDescending(arrObj);
        res.render("pending.ejs",{array: sortedComplaints , name: req.user.name, state: req.user.state, flag : false});
        arrObj=[];
    });
});

//Partially Solved Route
router.get("/partiallysolved",ensureAuthenticated,function (req,res) {
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        var q = url.parse(req.url, true);
        var qData = q.query;
        var order = qData.order;
        var count = 0;
        var sortedComplaints='';
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Partially Solved"){
                            arrObj.push(allUsers[user].complaints[complaint]);
    						arrObj[count].user=allUsers[user];
	    					arrObj[count].userId=user;
		    				arrObj[count].complaintId=complaint;
			    			count++;
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Partially Solved"){
                            if(allUsers[user].complaints[complaint].state == req.user.state)
                            {
                                arrObj.push(allUsers[user].complaints[complaint]);
    						    arrObj[count].user=allUsers[user];
	    					    arrObj[count].userId=user;
		    				    arrObj[count].complaintId=complaint;
			    			    count++;
                            }
                        }
                    });
                }
            });
        }
        //console.log(arrObj);
        for( var i=0 ; i < arrObj.length ; i++ ){
            toFormat(i,arrObj[i].dateofcomplaint);
        }
        if(order == 'ls'){
            sortedComplaints = sortAscending(arrObj);
        }else{
            sortedComplaints = sortDescending(arrObj);
        }
        res.render("partiallysolved.ejs",{array: sortedComplaints , name: req.user.name, state: req.user.state, flag : true});
        array=[];
        arrObj=[];
    });
});

//Partially Solved Search
router.post("/searchpartiallysolved",ensureAuthenticated,function (req,res) {
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        var count = 0;
        const {search} = req.body;
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Partially Solved"){
                            if(isNaN(search)){
                                if(allUsers[user].complaints[complaint].c_type == search){
                                    arrObj.push(allUsers[user].complaints[complaint]);
                                    arrObj[count].user=allUsers[user];
                                    arrObj[count].userId=user;
                                    arrObj[count].complaintId=complaint;
                                    count++;
                                }
                            }else{
                                if(complaint === search){
                                    arrObj.push(allUsers[user].complaints[complaint]);
                                    arrObj[count].user=allUsers[user];
                                    arrObj[count].userId=user;
                                    arrObj[count].complaintId=complaint;
                                    count++;
                                }
                            }
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Partially Solved"){
                            if(allUsers[user].complaints[complaint].state == req.user.state)
                            {
                                if(isNaN(search)){
                                    if(allUsers[user].complaints[complaint].c_type == search){
                                        arrObj.push(allUsers[user].complaints[complaint]);
                                        arrObj[count].user=allUsers[user];
                                        arrObj[count].userId=user;
                                        arrObj[count].complaintId=complaint;
                                        count++;
                                    }
                                }else{
                                    if(complaint === search){
                                        arrObj.push(allUsers[user].complaints[complaint]);
                                        arrObj[count].user=allUsers[user];
                                        arrObj[count].userId=user;
                                        arrObj[count].complaintId=complaint;
                                        count++;
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }
        for( var i=0 ; i < arrObj.length ; i++ ){
			toFormat(i,arrObj[i].dateofcomplaint);
        }
        sortedComplaints = sortDescending(arrObj);
        res.render("partiallysolved.ejs",{array: sortedComplaints , name: req.user.name, state: req.user.state, flag : false});
        arrObj=[];
    });
});

//Redressed Route
router.get("/redressed",ensureAuthenticated,function (req,res) {
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        var q = url.parse(req.url, true);
        var qData = q.query;
        var order = qData.order;
        var count = 0;
        var sortedComplaints='';
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                            arrObj.push(allUsers[user].complaints[complaint]);
    						arrObj[count].user=allUsers[user];
	    					arrObj[count].userId=user;
		    				arrObj[count].complaintId=complaint;
			    			count++;
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                            if(allUsers[user].complaints[complaint].state == req.user.state)
                            {
                                arrObj.push(allUsers[user].complaints[complaint]);
        						arrObj[count].user=allUsers[user];
		        				arrObj[count].userId=user;
				        		arrObj[count].complaintId=complaint;
						        count++;
                            }
                        }
                    });
                }
            });
        }
        for( var i=0 ; i < arrObj.length ; i++ ){
			toFormat(i,arrObj[i].dateofcomplaint);
        }
        if(order == 'ls'){
            sortedComplaints = sortAscending(arrObj);
        }else{
            sortedComplaints = sortDescending(arrObj);
        }
        res.render("redressed.ejs",{array: sortedComplaints, name: req.user.name, state: req.user.state , flag: true});
        count=0;
        arrObj=[];
    });
});

//Redressed Search
router.post("/searchredressed",ensureAuthenticated,function (req,res) {
    var flag = true;
    ref.once("value", function(snapshot) {
    var allUsers = snapshot.val();   //Data is in JSON format.
    count=0;
    const {search} = req.body;
    if(req.user.state == "Main"){
        Object.keys(allUsers).forEach((user) => {
            if(allUsers[user].complaints)
            {
                Object.keys(allUsers[user].complaints).forEach((complaint) => {
                    if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                        if(isNaN(search)){
                            if(allUsers[user].complaints[complaint].c_type == search){
                                arrObj.push(allUsers[user].complaints[complaint]);
        						arrObj[count].user=allUsers[user];
		        				arrObj[count].userId=user;
				        		arrObj[count].complaintId=complaint;
						        count++;
                            }
                        }else{
                            var arrOfCmpId = Object.keys(allUsers[user].complaints);
                            for(var i=0;i<arrOfCmpId.length;i++){
                                if(arrOfCmpId[i] === search && flag == true){
                                    arrObj.push(allUsers[user].complaints[complaint]);
        						    arrObj[count].user=allUsers[user];
                                    arrObj[count].userId=user;
                                    arrObj[count].complaintId=complaint;
                                    count++;
                                    flag = false;
                                }
                            }
                        }
                    }
                });
            }
        });
    }else{
        Object.keys(allUsers).forEach((user) => {
            //console.log(user);
            if(allUsers[user].complaints)
            {
                Object.keys(allUsers[user].complaints).forEach((complaint) => {
                    if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                        if(allUsers[user].complaints[complaint].state == req.user.state)
                        {
                            if(isNaN(search)){
                                if(allUsers[user].complaints[complaint].c_type == search){
                                    arrObj.push(allUsers[user].complaints[complaint]);
        						    arrObj[count].user=allUsers[user];
                                    arrObj[count].userId=user;
                                    arrObj[count].complaintId=complaint;
                                    count++;
                                }
                            }else{
                                var arrOfCmpId = Object.keys(allUsers[user].complaints);
                                for(var i=0;i<arrOfCmpId.length;i++){
                                    if(arrOfCmpId[i] === search && flag == true){
                                        arrObj.push(allUsers[user].complaints[complaint]);
                                        arrObj[count].user=allUsers[user];
                                        arrObj[count].userId=user;
                                        arrObj[count].complaintId=complaint;
                                        count++;
                                        flag = false;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        });
    }
    for( var i=0 ; i < arrObj.length ; i++ ){
        toFormat(i,arrObj[i].dateofcomplaint);
    }
    sortedComplaints = sortDescending(arrObj);
    res.render("redressed.ejs",{array: sortedComplaints , name: req.user.name, state: req.user.state, flag:false });
    arrObj=[];
    });
});

// On click route from pending to redressed
router.get("/redressing/:user/:complaint/:redirection",ensureAuthenticated,function(req,res){
    var userId = req.params.user;
    var complaintId = req.params.complaint;
    var redirect = req.params.redirection;
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();
        var message = "Hello <b>"+ allUsers[userId].fname + " "+ allUsers[userId].lname+",</b><br> Your complaint with complaint ID: <b>"+
            complaintId+"</b> has been resolved successfully."+
            "<ul><li><b>Complaint type</b> : "+allUsers[userId].complaints[complaintId].c_type+"</li>"+
            "<li><b>Complaint Sub-type</b> : "+allUsers[userId].complaints[complaintId].c_subtype+"</li>"+
            "<li><b>Address : </b>"+allUsers[userId].complaints[complaintId].area+"</li>"+
            "<li><b>Date of Complaint</b> : "+allUsers[userId].complaints[complaintId].dateofcomplaint+"</li></ul>"+
            "Thank you for using our service<br>"+
            "Your complaint was solved by "+req.user.name+"("+req.user.state+")"+
            "<br>"+"Feel free to contact us<br> E-mail: "+ req.user.email

        const oauth2Client = new OAuth2(
            "683518118967-pcbst9mtj1vmnaveiv9v2q615btdchlk.apps.googleusercontent.com", // ClientID
            "q-Wr-YL2fjw9qlq1_KGNRJEi", // Client Secret
            "https://developers.google.com/oauthplayground" // Redirect URL
        );
        
        oauth2Client.setCredentials({
            refresh_token: "1//04dFbeGGzDh3wCgYIARAAGAQSNwF-L9IrRTdCOXCZVtddDgKjLv-kKCyJd4mJW2ep5q7HGEc1DFmNny3wGobW8C4plS3wH97Qt7g"
        });

        const accessToken = oauth2Client.getAccessToken()
        
        const smtpTransport = nodemailer.createTransport({
            service: "gmail",
            auth: {
                 type: "OAuth2",
                 user: "allindiagrievanceredressalapp@gmail.com", 
                 clientId: "683518118967-pcbst9mtj1vmnaveiv9v2q615btdchlk.apps.googleusercontent.com",
                 clientSecret: "q-Wr-YL2fjw9qlq1_KGNRJEi",
                 refreshToken: "1//04dFbeGGzDh3wCgYIARAAGAQSNwF-L9IrRTdCOXCZVtddDgKjLv-kKCyJd4mJW2ep5q7HGEc1DFmNny3wGobW8C4plS3wH97Qt7g",
                 accessToken: accessToken
            }
        });

        const mailOptions = {
            from: "allindiagrievanceredressalapp@gmail.com",
            to: allUsers[userId].email,
            subject: "All India Grievance Redressal App - Complaint Solved Successfully",
            generateTextFromHTML: true,
            html: message
        };

        smtpTransport.sendMail(mailOptions, (error, response) => {
            if(error)
            {
                console.log(error);
            }
            smtpTransport.close();
        });
        
        //Sending notification
        refWorkers.once("value",function(snapshot){
            let allWorkers = snapshot.val();
            var workerToken;
            Object.keys(allWorkers).forEach((worker) => {
                if(worker == allUsers[userId].complaints[complaintId].workerId)
                {
                    workerToken = allWorkers[worker].token;
                }
            });
        
            var registrationToken = [allUsers[userId].token, workerToken];

            var payload = {
                notification: {
                    title: allUsers[userId].complaints[complaintId].c_type,
                    body: "Your Complaint has been solved! Which was "+allUsers[userId].complaints[complaintId].c_subtype+" related complaint. Click to view the details"
                },
                data: {
                    userId: userId,
                    workerId: allUsers[userId].complaints[complaintId].workerId,
                    complaintId: complaintId
                }
            };

            var options = {
                priority: "high",
                timeToLive: 60 * 60
            };

            admin.messaging().sendToDevice(registrationToken, payload, options)
                .then(function(response) {
                    console.log("Successfully sent message:", response);
                })
                .catch(function(error) {
                    console.log("Error sending message:", error);
                });
        });
    });
    datab.ref("user/"+userId+"/complaints/"+complaintId+"/status").set("Complaint Solved");

    if(redirect == "partiallysolved")
    {
        res.redirect("/../users/partiallysolved");
    }else{
        res.redirect("/../users/viewcomplaint/redressed/"+userId+"/"+complaintId);
    }
});

//View Complaint
router.get("/viewcomplaint/:source/:user/:complaint",ensureAuthenticated,function(req,res){
    var userId = req.params.user;
    var complaintId = req.params.complaint;
    var source = req.params.source;
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();
        let userName = allUsers[userId].fname +" "+allUsers[userId].lname;
        let workerId = allUsers[userId].complaints[complaintId].workerId;
        refWorkers.once("value",function(snapshot){
            let allWorkers = snapshot.val();
            if((source === "partiallysolved") || (source === "redressed")){
                Object.keys(allWorkers).forEach((worker) => {
                    if(worker == workerId){
                        let workerName = allWorkers[worker].fname +" "+ allWorkers[worker].lname;
                        res.render('viewcomplaint.ejs',{adminName: req.user.name, state: req.user.state , userName:userName,
                            userEmail:allUsers[userId].email,userMobile: allUsers[userId].mobile,
                            cmpType:allUsers[userId].complaints[complaintId].c_type,
                            cmpSubType:allUsers[userId].complaints[complaintId].c_subtype,
                            cmpArea:allUsers[userId].complaints[complaintId].area,
                            cmpImage:allUsers[userId].complaints[complaintId].url,
                            cmpLantitude:allUsers[userId].complaints[complaintId].lantitude,
                            cmpLongitude:allUsers[userId].complaints[complaintId].longitude,
                            cmpDescription:allUsers[userId].complaints[complaintId].description,
                            cmpDate:allUsers[userId].complaints[complaintId].dateofcomplaint,
                            cmpStatus:allUsers[userId].complaints[complaintId].status,
                            cmpSolvedImg:allUsers[userId].complaints[complaintId].solved_url,
                            userID:userId, cmpID:complaintId,
                            workerEmail:allWorkers[worker].email,workerName: workerName,
                            workerMobile:allWorkers[worker].mobile, workerPresent: true
                        });
                    }
                });    
            }else{
                res.render('viewcomplaint.ejs',{adminName: req.user.name, state: req.user.state , userName:userName,
                    userEmail:allUsers[userId].email,userMobile: allUsers[userId].mobile,
                    cmpType:allUsers[userId].complaints[complaintId].c_type,
                    cmpSubType:allUsers[userId].complaints[complaintId].c_subtype,
                    cmpArea:allUsers[userId].complaints[complaintId].area,
                    cmpImage:allUsers[userId].complaints[complaintId].url,
                    cmpLantitude:allUsers[userId].complaints[complaintId].lantitude,
                    cmpLongitude:allUsers[userId].complaints[complaintId].longitude,
                    cmpDescription:allUsers[userId].complaints[complaintId].description,
                    cmpDate:allUsers[userId].complaints[complaintId].dateofcomplaint,
                    cmpStatus:allUsers[userId].complaints[complaintId].status,
                    userID:userId, cmpID:complaintId, workerPresent: false
                });
            }
        });
    });
});

//Arrays used for analysis
var totCmp=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
var totsol=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
var percentage=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

//Analysis
router.get('/analysis',ensureAuthenticated,function(req,res){
    ref.once("value", function(snapshot) {
        var allUsers = snapshot.val();   //Data is in JSON format.
        if(req.user.state == "Main"){
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].c_type == "Solid Waste Management"){
                            totCmp[0] = totCmp[0]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved")
                                totsol[0]=totsol[0]+1;
                            percentage[0]=parseInt((totsol[0]/totCmp[0])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Roads and traffic"){
                            totCmp[1] = totCmp[1]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[1]=totsol[1]+1;
                            }
                            percentage[1]=parseInt((totsol[1]/totCmp[1])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Water Supply"){
                            totCmp[2] = totCmp[2]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[2]=totsol[2]+1;
                            }
                            percentage[2]=parseInt((totsol[2]/totCmp[2])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Buildings"){
                            totCmp[3] = totCmp[3]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[3]=totsol[3]+1;
                            }
                            percentage[3]=parseInt((totsol[3]/totCmp[3])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Drainage"){
                            totCmp[4] = totCmp[4]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[4]=totsol[4]+1;
                            }
                            percentage[4]=parseInt((totsol[4]/totCmp[4])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Storm water drain"){
                            totCmp[5] = totCmp[5]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[5]=totsol[5]+1;
                            }
                            percentage[5]=parseInt((totsol[5]/totCmp[5])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Factories"){
                            totCmp[6] = totCmp[6]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[6]=totsol[6]+1;
                            }
                            percentage[6]=parseInt((totsol[6]/totCmp[6])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Licence"){
                            totCmp[7] = totCmp[7]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[7]=totsol[7]+1;
                            }
                            percentage[7]=parseInt((totsol[7]/totCmp[7])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Colony Officer"){
                            totCmp[8] = totCmp[8]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[8]=totsol[8]+1;
                            }
                            percentage[8]=parseInt((totsol[8]/totCmp[8])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Pest Control"){
                            totCmp[9] = totCmp[9]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[9]=totsol[9]+1;
                            }
                            percentage[9]=parseInt((totsol[9]/totCmp[9])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Repairs to Municipal Property"){
                            totCmp[10] = totCmp[10]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[10]=totsol[10]+1;
                            }
                            percentage[10]=parseInt((totsol[10]/totCmp[10])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Health"){
                            totCmp[11] = totCmp[11]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[11]=totsol[11]+1;
                            }
                            percentage[11]=parseInt((totsol[11]/totCmp[11])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Garden and Tree"){
                            totCmp[12] = totCmp[12]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[12]=totsol[12]+1;
                            }
                            percentage[12]=parseInt((totsol[12]/totCmp[12])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Encroachment"){
                            totCmp[13] = totCmp[13]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[13]=totsol[13]+1;
                            }
                            percentage[13]=parseInt((totsol[13]/totCmp[13])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Shops and Establishment"){
                            totCmp[14] = totCmp[14]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[14]=totsol[14]+1;
                            }
                            percentage[14]=parseInt((totsol[14]/totCmp[14])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Estate"){
                            totCmp[15] = totCmp[15]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[15]=totsol[15]+1;
                            }
                            percentage[15]=parseInt((totsol[15]/totCmp[15])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "School"){
                            totCmp[16] = totCmp[16]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[16]=totsol[16]+1;
                            }
                            percentage[16]=parseInt((totsol[16]/totCmp[16])*100);
                        }else if(allUsers[user].complaints[complaint].c_type == "Sewerage Operation Control"){
                            totCmp[17] = totCmp[17]+ 1;
                            if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                totsol[17]=totsol[17]+1;
                            }
                            percentage[17]=parseInt((totsol[17]/totCmp[17])*100);
                        }
                    });
                }
            });
        }else{
            Object.keys(allUsers).forEach((user) => {
                if(allUsers[user].complaints)
                {
                    Object.keys(allUsers[user].complaints).forEach((complaint) => {
                        if(allUsers[user].complaints[complaint].state == req.user.state)
                        {
                            if(allUsers[user].complaints[complaint].c_type == "Solid Waste Management"){
                                totCmp[0] = totCmp[0]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved")
                                    totsol[0]=totsol[0]+1;
                                percentage[0]=parseInt((totsol[0]/totCmp[0])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Roads and traffic"){
                                totCmp[1] = totCmp[1]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[1]=totsol[1]+1;
                                }
                                percentage[1]=parseInt((totsol[1]/totCmp[1])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Water Supply"){
                                totCmp[2] = totCmp[2]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[2]=totsol[2]+1;
                                }
                                percentage[2]=parseInt((totsol[2]/totCmp[2])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Buildings"){
                                totCmp[3] = totCmp[3]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[3]=totsol[3]+1;
                                }
                                percentage[3]=parseInt((totsol[3]/totCmp[3])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Drainage"){
                                totCmp[4] = totCmp[4]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[4]=totsol[4]+1;
                                }
                                percentage[4]=parseInt((totsol[4]/totCmp[4])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Storm water drain"){
                                totCmp[5] = totCmp[5]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[5]=totsol[5]+1;
                                }
                                percentage[5]=parseInt((totsol[5]/totCmp[5])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Factories"){
                                totCmp[6] = totCmp[6]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[6]=totsol[6]+1;
                                }
                                percentage[6]=parseInt((totsol[6]/totCmp[6])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Licence"){
                                totCmp[7] = totCmp[7]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[7]=totsol[7]+1;
                                }
                                percentage[7]=parseInt((totsol[7]/totCmp[7])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Colony Officer"){
                                totCmp[8] = totCmp[8]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[8]=totsol[8]+1;
                                }
                                percentage[8]=parseInt((totsol[8]/totCmp[8])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Pest Control"){
                                totCmp[9] = totCmp[9]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[9]=totsol[9]+1;
                                }
                                percentage[9]=parseInt((totsol[9]/totCmp[9])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Repairs to Municipal Property"){
                                totCmp[10] = totCmp[10]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[10]=totsol[10]+1;
                                }
                                percentage[10]=parseInt((totsol[10]/totCmp[10])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Health"){
                                totCmp[11] = totCmp[11]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[11]=totsol[11]+1;
                                }
                                percentage[11]=parseInt((totsol[11]/totCmp[11])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Garden and Tree"){
                                totCmp[12] = totCmp[12]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[12]=totsol[12]+1;
                                }
                                percentage[12]=parseInt((totsol[12]/totCmp[12])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Encroachment"){
                                totCmp[13] = totCmp[13]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[13]=totsol[13]+1;
                                }
                                percentage[13]=parseInt((totsol[13]/totCmp[13])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Shops and Establishment"){
                                totCmp[14] = totCmp[14]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[14]=totsol[14]+1;
                                }
                                percentage[14]=parseInt((totsol[14]/totCmp[14])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Estate"){
                                totCmp[15] = totCmp[15]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[15]=totsol[15]+1;
                                }
                                percentage[15]=parseInt((totsol[15]/totCmp[15])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "School"){
                                totCmp[16] = totCmp[16]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[16]=totsol[16]+1;
                                }
                                percentage[16]=parseInt((totsol[16]/totCmp[16])*100);
                            }else if(allUsers[user].complaints[complaint].c_type == "Sewerage Operation Control"){
                                totCmp[17] = totCmp[17]+ 1;
                                if(allUsers[user].complaints[complaint].status == "Complaint Solved"){
                                    totsol[17]=totsol[17]+1;
                                }
                                percentage[17]=parseInt((totsol[17]/totCmp[17])*100);
                            }
                        }
                    });
                }
            });
        }
        res.render("analysis.ejs",{name: req.user.name, state: req.user.state,
            percentage:percentage , totCmp:totCmp,totsol:totsol});

        totCmp      =[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
        totsol      =[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
        percentage  =[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    });
});

module.exports = router;