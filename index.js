const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const redis = require ('redis');
const mongoose = require ('mongoose');
const neo4j = require('neo4j-driver');

const Movies = require ('./movies'); // importing movies schema

// mongo connection using mongoose library
mongoose.connect("mongodb://localhost:27017/Movies", {
    useNewUrlParser: true,
    useUnifiedTopology : true});

const PORT = process.env.PORT || 5000;

const REDIS_PORT = process.env.PORT || 6379;
const redisclient = redis.createClient(REDIS_PORT); // redis connection 
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('raj', '1234')); //neo4j connection
const session = driver.session();
const app = express();
// Enable express to parse body data from raw application/json data
app.use(bodyParser.json());
// Enables express to parse body data from x-www-form-encoded data
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public')));

async function getMoviebyTitle(req,res) {
        try{
            const result = [];
            const searchkey = req.params.name;
            console.log("Fetching Movie by Title "+ searchkey);
            //finding movie details from mongo
            Movies.find({"title" : searchkey}, function(err, items){
              if (items.length !== 0 ){
                var movie = [];
                var z = "";
                var x = searchkey ;
                
                for (var i = 0 ; i < items.length ; i++){    
                  movie.push(items[i]);
                  console.log(movie);
                  z= items[i].title;
                  if (req.params.username){
                    key = req.params.username +  '-searched';
                    searchcount = req.params.username +  '-count';
                    redisclient.sadd(key,JSON.stringify(z) );//setting the search result for a particular user in redis for search history
                    redisclient.incr(searchcount ); // setting the search count for a user in redis for offers
                    }}
                    //getting movie recommendation with the searched movie's genre and director from neo4j
                session.run('MATCH (m:movie) WHERE m.name = $title SET  m.searchcount= m.searchcount+ 1 WITH m OPTIONAL MATCH (m)-[:Belong_To]->()<-[:Belong_To]-(x) WITH m, COLLECT(x) AS xs OPTIONAL MATCH (m)<-[:Directed]-()-[:Directed]->(y) WITH m, xs, COLLECT(y) AS ys UNWIND (xs + ys) AS otherMovie RETURN otherMovie',
                            { title:searchkey}
                        )
                        
                         .then(function (recommendations) {
                            recommendations.records.forEach(function(record){
                                result.push(record._fields[0].properties.name);  
                            })
                            console.log(result);
                            var y = [movie , result];
                            redisclient.setex ( x,600, JSON.stringify(y)); // storing searched movie data and related recommendations in redis
                            res.json(y);
                            })
                        .catch(function(error){
                            console.log(error);
                        })   
                  }
                if(items.length=== 0){
                    res.send("Invalid search key");
                }}
              )   
        }
        catch(err){
            console.error(err);
            res.status(500);
        }
    }
async function getMoviebyActor(req,res) {
    try{
        console.log("Fetching Data via actor..");
        const searchkey = req.params.name;
        console.log(searchkey);
        const movies =[];
        // Getting movie list based on actor search from Neo4j
        session.run("Match (a:actor) where a.name = $actor match (a)-[:Acted_In]-(x) with COLLECT(x) as xs UNWIND (xs) as movies Return movies",
            { actor: searchkey }
                )
               .then(function (results) {
                   
                  if (results.records.length == 0){
                    res.send("Incorrect search") 
                    }
                  else{
                    results.records.forEach(function(record){
                        movies.push(record._fields[0].properties.name);  // pushing the search record in array       
                        })
                    console.log("Data is fetched from Neo4j");
                    
                    
                    redisclient.setex ( searchkey,600, JSON.stringify(movies));// storing search result in redis for cache
                    if (req.params.username){
                        key = req.params.username +  '-searched';
                        searchcount = req.params.username +  '-count'
                        redisclient.incr(searchcount ); // setting the search count for a user in redis for offers
                        movies.forEach(element => {
                            redisclient.sadd(key,JSON.stringify(element) );//setting the search result for a particular user in redis for search history
                        });
                    }
                    res.json(movies);
                    }
                  
                })
               .catch(function(error){
                console.log(error);  
          }) 
    }
    catch(err){
        console.error(err);
        res.status(500);
    }
}


async function getMoviebyDirector(req,res) {
    try{
        console.log("Fetching Data via Director..");
        const searchkey = req.params.name;
        console.log(searchkey);
        const movies =[];
        // Getting movie list based on director search from Neo4j
        session.run("Match (d:director) where d.name = $director match (d)-[:Directed]-(x) with COLLECT(x) as xs UNWIND (xs) as movies Return movies",
                    { director: searchkey }
                    )
               .then(function (results) {
                   if(results.record.lenght > 0){
                    results.records.forEach(function(record){ 
                        console.log("record._fields[0].properties = ",record._fields[0].properties.name);
                        movies.push(record._fields[0].properties.name);     
                    })
                    console.log("Data is fetched from Neo4j");
                    
                    console.log(movies);
                    redisclient.setex ( searchkey,600, JSON.stringify(movies));// storing search result in redis for cache
                    if (req.params.username){
                        key = req.params.username +  '-searched';
                        searchcount = req.params.username +  '-count';
                        redisclient.incr(searchcount);// setting the search count for a user in redis for offers
                        movies.forEach(element => {
                            redisclient.sadd(key,JSON.stringify(element));//setting the search result for a particular user in redis for search history
                        });
                    }
                    res.json(movies); 
                }
                else {
                    res.send("Incorrect Search");
                }            
                })
               .catch(function(error){
                console.log(error);  
          })    
    }
    catch(err){
        console.error(err);
        res.status(500);
    }
}

async function getMoviebyGenre(req,res) {
    try{
        console.log("Fetching Movies with Genre..");
        const searchkey = req.params.name;
        console.log(searchkey);
        const movies =[];
        // Getting movie list based on Genre search from Neo4j
        session.run("Match (g:genre) where g.name = $genre match (g)-[:Belong_To]-(x) with COLLECT(x) as xs UNWIND (xs) as movies Return movies",
                    { genre: searchkey }
                )
                .then(function (results) {
                  if(results.records.length > 0){
                    results.records.forEach(function(record){
                        console.log("record._fields[0].properties = ",record._fields[0].properties.name);
                        movies.push(record._fields[0].properties.name);  
                    })
                    console.log("Data is fetched from Neo4j");
                   
                    console.log(movies);
                    redisclient.setex ( searckey,600, JSON.stringify(movies));// storing search result in redis for cache
                    if (req.params.username){
                        key = req.params.username +  '-searched'
                        searchcount = req.params.username +  '-count'
                        redisclient.incr(searchcount );// setting the search count for a user in redis for offers
                        movies.forEach(element => {
                            redisclient.sadd(key,JSON.stringify(element));//setting the search result for a particular user in redis for search history
                        });
                    }
                    res.json(movies);
                }
                  else{
                      res.send("Incorrect Search");
                  }
                })
            .catch(function(error){
            console.log(error); 
            })    
    }
    catch(err){
        console.error(err);
        res.status(500);
    }
}

async function getMoviebyPreference(req,res) {
    try{
        console.log("Fetching Movies by User Preference ..");
        const searchkey = req.params.username;
        const result =[];
        console.log(searchkey);
        //Getting movie list based on the preferred genres for a user 
        session.run('MATCH (u:username) WHERE u.name = $username MATCH (u)-[:Prefers]->()<-[:Belong_To]-(x) WITH u COLLECT(x) AS xs UNWIND (xs) AS Recommendation RETURN Recommendation',
                    { username: searchkey }
                    )
        
                .then(function (recommendations) {
                    recommendations.records.forEach(function(record){
                        console.log(recommendations);
                        //console.log("record._fields[0].properties = ",record._fields[0].properties.name);
                        result.push(record._fields[0].properties.name);   
                    })
                    console.log(result);
                    redisclient.setex ( searchkey,600, JSON.stringify(result));// storing the result in redis for a user for cache
                    res.json(result);
                })
                .catch(function(error){
                console.log(error);
                })    

    }
    catch(err){
        console.error(err);
        res.status(500);
    }
}


function cache(req, res, next){
    var searchkey;
    if (!req.params.name){
        searchkey=req.params.username; //setting search key for cache search
        
        console.log(searchkey);   
    }
    else if(req.params.name) {
        searchkey = req.params.name; //setting search key for cache search
        console.log(searchkey);
    }
    movies = [];
    // getting data from client based on searchkey
    redisclient.get(searchkey, (err ,data)=>{
            if (err) throw err;
            if (data !== null){
                console.log(" Data is coming from redis"); 
                session.run('MATCH (m:movie) WHERE m.name = $title SET  m.searchcount= m.searchcount+ 1 ',
                {title : searchkey})
                .then(function (result) {
                    
                })
                .catch(function(error){
                console.log(error);
                })
                
                //console.log(JSON.parse(data));
                result = JSON.parse(data); 
                
                if (req.params.username){

                    searchcount =req.params.username +  '-count';
                    redisclient.incr(searchcount );
                }
                res.json(result);
            }
            else{
                next();  // calling next function in the api if no result found in redis for the search 
            }})     
    }

// function to get the list of the movies based on users search history
function getSearchBasedResutls(req,res){
    key = req.params.username +  '-searched';
    redisclient.smembers( key , (err,data)=>{
        if (err) throw err;
        if (data){
            res.json(data);
        }
        if(!data){
            res.send('You dont have any search history');
        }

    })
}

function getAvailableOffers(req,res){
    key= req.params.username+'-count';
    
    redisclient.get(key,(err,data)=>{ //getting the search count performed by the user
        if (err) throw err;
        if(data === null){
            res.send("No offers Available");
        }
        data= parseInt(data);
        if (data){
            if( 5<= data <10 ){
                offername = "free lunch coupons";
            }
            else if( 10<= data <50){
                offername = "free movie tickets";
            }
            // creating offer for user based on search count
            session.run("Match (u:username) where u.name = $username Merge (p:promotion {name:$offer})-[:Available_For]-> (u) on create SET p.offercode = apoc.text.random(7,'A-Za-z0-9') ",
                    { username: req.params.username,
                     offer: offername }
                        )
                    .then(function (result) {
                        offerlist = [];
                        session.run(" Match ( u: username) where u.name = $username Match (u)-[:Available_For]-(x) Return x",
                        { username: req.params.username }
                                )
                                .then (function (offers){
                                    offers.records.forEach(function(record){
                                        offerlist.push(record._fields[0].properties);
                                    })
                                    res.json(offerlist);
                       
                                })
                                .catch(function(error){
                                    console.log(error);
                                })
                        
                    })
                    .catch(function(error){
                    console.log(error);
                    })  
        }
        
    })
}

async function addMoviestoUserlist(req,res) 
{
    try
    {
        console.log("Adding movie to wishlist using Neo4j...");
        const searchkey = req.params.email;
        const moviename = req.params.title;
        const listofmovie =[];
        console.log(searchkey);
        console.log(moviename);         
        session.run('MATCH (a:movie), (b:us_name) WHERE a.name = $movietitle AND b.email = $username MERGE (a)-[r: IN_Wishlist]->(b) return a', //Create a relationship between a user and a movie if it doesn't exists.
        {   username: searchkey,
            movietitle : moviename
        }).then(function (movie) 
            {                    
                movie.records.forEach(function(record)
                {                    
                    listofmovie.push(record._fields[0].properties.name);   
                })                
                if(listofmovie.length > 0)
                {
                    console.log(listofmovie[0], "  Movie has been added to your wishlist");                                    
                    res.json(listofmovie[0]);
                }
                else
                {
                    console.log("Please check if the username and movie entered are correct or check your wish list if movie is already present");
                }                
            }).catch(function(error)
            {
                console.log(error);
            }) 
    }
    catch(err)
    {
        console.error(err);
        res.status(500);
    }
}

async function fetchmoviesfromlist(req,res) 
{
    try
    {
        console.log("Fetching movie from wishlist using Neo4j...");
        const username = req.params.checkname;            
        const listofmovie =[];
        const recommendedmovies = [];             
        session.run('MATCH (p)-[r:IN_Wishlist]->(n) where n.email= $name1 RETURN distinct p', // This will return movies added by user in his/her wish list.
        {   
            name1: username,                
        }).then(function (movies) 
            {                    
                movies.records.forEach(function(record)
                {                    
                    listofmovie.push(record._fields[0].properties.name);   
                })                
                if(listofmovie.length > 0)
                {
                    console.log("Your wish list contains: ",listofmovie);                                                        
                    var x = username + '-wishlist';
                    
                    // Storing the result in redis for a user for cache.                                                                                            
                    redisclient.setex(x, 60, JSON.stringify(listofmovie));                                                           
                    res.json(listofmovie);                
                    
                    // Showing user what others have added in their wish list.
                    session.run('MATCH (p)-[r:IN_Wishlist]->(n) where n.email <> $name1 RETURN distinct p.name as movie', 
                    {   
                        name1: username,                    
                    }).then(function (valueofp) 
                        {                           
                            valueofp.records.forEach(function(record)
                            {                    
                                recommendedmovies.push(record._fields[0]);   
                            })                
                            console.log("Check what movies other users have added to their wishlist: ",recommendedmovies);                                                               
                        }).catch(function(error)
                        {
                            console.log(error);
                        })
                }
                else
                {
                    console.log("Please check if the username entered is correct also add movies to wishlist in order to view them"); // Incase if username is incorrect or there are no movies in user's wish list then the else block will be executed.
                    session.run('MATCH (p)-[r:IN_Wishlist]->(n) where n.email <> $name1 RETURN distinct p.name as movie', // Showing user what others have added in their wish list.
                        {   
                            name1: username,                    
                        }).then(function (valueofp) 
                        {                           
                            valueofp.records.forEach(function(record)
                            {                    
                                recommendedmovies.push(record._fields[0]);   
                            })                
                            console.log("Check what movies other users have added to their wishlist: ",recommendedmovies);                                                               
                        }).catch(function(error)
                        {
                            console.log(error);
                        })
                }
                
            }).catch(function(error)
            {
                console.log(error);
            }) 
    }
    catch(err)
    {
        console.error(err);
        res.status(500);
    }
}

function fetchmoviesredis(req,res)
{
    key = req.params.username +  '-wishlist'; // Storing requested user wish list in redis as cache.
    redisclient.get( key , (err,data)=>
    {
        if (err) throw err;
        if (data)
        {
            res.json(data);
        }
        if(!data)
        {
            res.send('You dont have any wishlist history');
        }
    })
}

async function getmutualfollowers(req,res) 
{
    try
    {
        console.log("Get mutual followers using Neo4j...");
        const username1 = req.params.checkname1;
        const username2 = req.params.checkname2;
        const useremail = [];                                            
        session.run('MATCH (a:us_name) WHERE a.email = $name1 MATCH (b:us_name) WHERE b.email =$name2 match (a)--(x:us_name)--(b) return distinct x.email', // Show mutual followers
        {   name1: username1,
            name2: username2
        }).then(function (checkemail) 
        {
            checkemail.records.forEach(function(record)
            {                    
                useremail.push(record._fields[0]);   
            })                
            if (useremail.length >0)
            {
                console.log("Your mutual followers are: ", useremail);
                res.json(useremail);                                  
            }
            else
            {
                console.log("Sorry you dont have common followers also, please check username again.");
            }                
        }).catch(function(error)
        {
            console.log(error);
        }) 
    }
    catch(err)
    {
        console.error(err);
        res.status(500);
    }
}

async function requesttoFollow(req,res) 
{
    try
    {
        console.log("Requesting to follow a user using Neo4j...");
        const username1 = req.params.checkname1;
        const username2 = req.params.checkname2;
        const useremail = [];                                            
        session.run('MATCH (a:us_name), (b:us_name) WHERE a.email= $name1 AND b.email = $name2 MERGE (a)-[: Follows]->(b) RETURN a', // A user can follow other user.
        {   name1: username1,
            name2: username2
        }).then(function (checkemail) 
        {
            checkemail.records.forEach(function(record)
            {                    
                useremail.push(record._fields[0].properties.email);   
            })                
            if (useremail == username1)
            {
                console.log("Accepted your follow request.");                                    
            }
            else
            {
                console.log("Please check the username again.");
            }                
        }).catch(function(error)
        {
            console.log(error);
        }) 
    }
    catch(err)
    {
        console.error(err);
        res.status(500);
    }
}

async function followUser(req,res) 
{
    try
    {
        console.log("Fetch movies from wishlist of a user whom you follow using Neo4j...");
        const username1 = req.params.checkname1;
        const username2 = req.params.checkname2;
        const realtionshipexists =[];
        const movierelationship =[];
        console.log(username1);
        console.log(username2);
        session.run('MATCH (p)-[r:Follows]->(n) where p.email=$name1 and n.email=$name2 Return r', // If both users follow each other only then they will be able to view each others wishlist.
        {   name1: username1,
            name2 : username2
        }).then(function (valueofr)
        {
            valueofr.records.forEach(function(record)
            {                    
            realtionshipexists.push(record._fields[0].type);   
            })                
            console.log(realtionshipexists[0]); 
            if(realtionshipexists[0] == "Follows")
            {                        
                session.run('MATCH (p)-[r:IN_Wishlist]->(n) where n.email=$name1 Return p limit(5)', // Show movies added by user in their wishlist, once verified that they are following each other.
                {   
                    name1: username1                    
                }).then(function (valueofp) 
                {                            
                    valueofp.records.forEach(function(record)
                    {                    
                        movierelationship.push(record._fields[0].properties.name);   
                    })                
                    console.log(movierelationship);                                   
                    res.json(movierelationship);
                }).catch(function(error)
                {
                    console.log(error);
                })
            }
            else
            {
                console.log("Please check the username and follow the user in order to view his/her wishlist");
            }                                                 
        }).catch(function(error)
        {
            console.log(error);
        })                        
    }
    catch(err)
    {
        console.error(err);
        res.status(500);
    }
}

function getTopMovies(req,res){
    trending = [];
    session.run("MATCH (m:movie) RETURN m ORDER BY m.searchcount DESC LIMIT 10 ",
        )
    .then(function (result) {
        result.records.forEach(function(record){
            trending.push(record._fields[0].properties.name); //storing the result in trending array
        })
        //console.log(offers);
        res.json(trending);
    })
    .catch(function(error){
    console.log(error);
    }) 
}

//app.get('/movie/addtouserlist/:email/:title', addMoviestoUserlist); // A user can add movies he likes or wishes to watch to his personal wish list.
app.get('/checkmutualfollowers/:checkname1/:checkname2', getmutualfollowers); // A user can Check for mutual followers before sending a follow request.
app.get('/movie/:email/:title', addMoviestoUserlist); // A user can add movies he likes or wishes to watch to his personal wish list.
app.get('/viewwishlist/:checkname', fetchmoviesfromlist);// Once movies are added a user look into movies added by him/her, also user will be recommended with movies added by other users.
app.get('/fetchfromwishlist/:username', fetchmoviesredis);// If a user wishes to view his wishlist within certain time it will be fetched from redis as movie list will stored as cache over there.
app.get('/requestingtofollow/:checkname1/:checkname2', requesttoFollow); // A user can follow other user.
app.get('/fetchmoviesofotheruser/:checkname1/:checkname2', followUser); // Once two users are following each other they can see what movies the other user has added to their wish list.
app.get('/:username/userpreference',cache, getMoviebyPreference); // for searching movies list based on the genre preferred by a registered user
app.get('/:username/availableoffers', getAvailableOffers) // for getting the list of the offers available for the user
app.get('/:username/userpreference',cache, getMoviebyPreference); // for searching movies list based on the genre preferred by a registered user
app.get('/:username/availableoffers', getAvailableOffers) // for getting the list of the offers available for the user
app.get('/movie/top10',getTopMovies);//for getting top searched movies across the globe on the application 
app.get('/movie/title/:name',cache, getMoviebyTitle); // for searching movie by title 
app.get('/movie/actor/:name',cache, getMoviebyActor);// for searching movies by actor
app.get('/movie/genre/:name',cache, getMoviebyGenre) ; // for searching movies by genre
app.get('/movie/director/:name',cache, getMoviebyDirector);// for searching movies by director
app.get('/:username/movie/:name',cache, getMoviebyTitle);// for searching movie by title for a registered user
app.get('/:username/actor/:name',cache, getMoviebyActor);// for searching movies by actor for a registered user
app.get('/:username/genre/:name',cache, getMoviebyGenre); // for searching movies by genre for a registered user
app.get('/:username/director/:name',cache, getMoviebyDirector);// for searching movies by director for a registered user
app.get('/:username/search',getSearchBasedResutls); // for getting the movie list based on search history of the user




app.listen(5000,() =>{
    console.log(`App listening on port ${PORT}`);
});