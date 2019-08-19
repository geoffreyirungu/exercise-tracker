const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid');
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGOLAB_URI);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
var schema = mongoose.Schema;
var personSchema = new schema({
  _id: String,
  username: String,
  description: [String], 
  duration: [Number],
  date: [String]
});
var person = mongoose.model('person',personSchema);
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

function validate(userId,description,duration,date){
  var regex=/^\s+$/;
  var notvalid = function(date){
    var d = ""
    if(Boolean(parseInt(date)))
      d= new Date(parseInt(date));
    else
      d = new Date(date);
    if(d == "Invalid Date" && date != ""){
      return true;
    }
    return false;
  }
  if(regex.test(userId) || userId == ""){
    return {"error": true, "type": "unknown id"}
  }
  else if(regex.test(description) || description == ""){
    return {"error": true, "type": "description required"}
  }
  else if(regex.test(duration) || Boolean(parseInt(duration)) == false || duration == ""){
    if(regex.test(duration) || duration == "")
      return {"error": true, "type": "duration required in minutes"}
    else
      return {"error": true, "type": "cast to number failed for value " + duration}
  }
  else if(notvalid(date)){
    return {"error": true, "type": "cast to date failed for " + date}
  }
  else{
    if(date == "")
      date = new Date().toDateString();
    else{
      if(Boolean(parseInt(date))){
        date = new Date(parseInt(date)).toDateString();
      }
      else{
        date = new Date(date).toDateString();
      }
    }
    userId = userId.toString();
    duration = parseInt(duration);
    return {
      "error": false,
      "userid":userId,
      "description":description,
      "duration":duration,
      "date": date
    };
  }
}

function validateLog(userid,from,to,limit){
  var d1= new Date(from);
  var d2= new Date(to);
  var timeDifference = d2.getTime() - d1.getTime();
  var now = new Date().getTime();
  var validTime = (((now - d2.getTime()) >= 0) && ((now - d1.getTime()) >= 0));
  if(d1 == "Invalid Date" || d2 == "Invalid Date" || (timeDifference < 0 && !validTime)){
    return {"error": true, "type": "invalid date(s) entered"};
  }
  else if(Boolean(parseInt(limit)) == false){
    return {"error":true, "type": "The limit is not a number"};
  }
  else if(!Boolean(userid)){
    return {"error":true, "type":"Invalid userid"}
  }
  else{
    from = new Date(from).toDateString();
    to = new Date(to).toDateString();
    limit = parseInt(limit);
    return {"error":false, "from":from, "to":to, "limit":limit, "userid":userid};
  }
}
app.post('/api/exercise/new-user',function(req,res){
  var newUser = req.body.username;
  var regex = /^\s+$/;
  if(newUser != "" && !regex.test(newUser)){
    person.findOne({username: newUser},function(err,data){
      if(err)
        res.json(err);
      if(data == null){
        var newPerson = new person({username: newUser, _id: shortid.generate()});
        newPerson.save((err,data)=> {
          res.json({"username": data.username, "_id": data._id});
        });
      }
      else{
        res.send("username already taken");
      }
    });
  }
  else{
    res.send("username is required");
  }
});

app.get('/api/exercise/users',function(req,res){
  person.find().exec((err,data)=>{
    var newData = data.map((obj) => {return {"username": obj.username, "_id": obj._id}});
    res.json(newData);
  });
  /*person.find().remove((err,data)=>{
    res.json(data);
  });*/
});

app.post('/api/exercise/add',function(req,res){
  var userId = req.body.userId;
  var description = req.body.description;
  var duration = req.body.duration;
  var date = req.body.date;
  var data = validate(userId,description,duration,date);
  if(!data.error){
    person.findById({_id:data.userid},(err,result)=>{
      if(err)
        res.json(err);
      
      result.description.push(data.description);
      result.duration.push(data.duration);
      result.date.push(data.date);
      result.save((err,updated)=> {if(err) res.json(err);});
      res.json({
        "username": result.username,
        "_id": result._id,
        "description": result.description[result.description.length -1],
        "duration": result.duration[result.duration.length -1],
        "date": result.date[result.date.length -1]
      });
    });
  }else{
    res.send(data.type);
  }
});

app.get('/api/exercise/log',function(req,res){
  var userid = req.query.userid;
  var from = req.query.from;
  var to = req.query.to;
  var limit = req.query.limit;

  if(Boolean(userid) && !Boolean(from) && !Boolean(to) && !Boolean(limit)){
    person.findById({_id:userid},(err,result)=>{
      if(err)
        res.json(err);
      if(result != null){
        let newData = JSON.stringify(result);
        newData = JSON.parse(newData);
        newData.totalexercisecount = result.duration.length;
        res.json(newData);
      }
      else
        res.send("unknown id");
    });
  }
  else{
    var data = validateLog(userid,from,to,limit);
    if(!data.error){
      userid = data.userid;
      from = data.from;
      to= data.to;
      limit= data.limit;
      person.findById({_id:userid},(err,result)=>{
        if(err)
          res.json(err);
        if(result != null){
          var dates = result.date.map((date,ind) => {
            var less = new Date(from).getTime();
            var boundary = new Date(to).getTime();
            var ref = new Date(date).getTime();
            if(ref>=less && ref<=boundary){
              return {date,ind};
            }
          });
          dates = dates.filter(obj => obj != null);
          var log ={
            "username": result.username,
            "_id": result._id,
            "description":[],
            "duration":[],
            "dates":[]
          };
          var startdate = dates.length -1;
          var index = dates[startdate].ind;
          var descdata = result.description;
          var durdata = result.duration;
          for(var i=0;i<limit;i++){
            log.dates.push(dates[startdate].date);
            log.description.push(descdata[index]);
            log.duration.push(durdata[index]);
            startdate --;
          }
          res.json(log);
        }else{
          res.send("Unknown id");
        }
      });
    }
    else{
      res.send(data.type);
    }
  }
  
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
