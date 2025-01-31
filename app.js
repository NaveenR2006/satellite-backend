const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const port = 3000;

let bcrypt=require("bcrypt")
let jwt=require("jsonwebtoken")

const mongodb = "mongodb+srv://naveen:naveen17@cluster0.e8nyh.mongodb.net/satellite";

// Configure CORS with specific options
app.use(cors({
  origin: ['https://satellite-frontend.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Connect to MongoDB and handle index creation
mongoose.connect(mongodb)
  .then(async () => {
    console.log("Connected to MongoDB successfully");
    
    // Get the collection and drop the problematic index
    try {
      const collection = mongoose.connection.collection('satellites');
      await collection.dropIndex('noradId_1');
      console.log("Successfully dropped noradId index");
    } catch (error) {
      console.log("Index might not exist, continuing...");
    }
    
    app.listen(port, () => {
      console.log(`Server is running at port ${port}`);
    });
  })
  .catch((err) => {
    console.log("Failed to connect to MongoDB:", err);
  });

const satelliteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  noradId: { type: String, required: false }, 
  name: { type: String, required: true },
  orbitType: { type: String, required: true },
  speed: { type: Number, required: true },
  altitude: { type: Number, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  lastUpdated: { type: Date, required: true ,default:Date.now },
  addedAt: { type: Date, required: true ,default:Date.now},
  visibility: { type: Boolean, required:true },
  details: { type: String, required: true }
},{
  collation: { locale: 'en', strength: 2 }
});

satelliteSchema.index({ id: 1 }, { unique: true });

const satelliteModel = mongoose.model("satellite", satelliteSchema);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

app.post("/api/register",async(req,res)=>{
  const {username,password}=req.body;
  const hashedPassword=await bcrypt.hash(password,10)
  let newUser=new User({username,password:hashedPassword});
  let savedUser=await newUser.save();
  res.status(200).json({message:"user register successfully",user:savedUser})
})

const authorize=(req,res,next)=>{
  const token=req.headers["authorization"].split(" ")[1];
  if(!token){
    return res.status(401).json({message:"no token provided"})
  }
  jwt.verify(token,"no-love",(err,userInfo)=>{
    if(err){
      return res.status(401).json({message:"unauthorized"})
    }
    req.user=userInfo;
    next()
  })
}

app.get("/api/secured",authorize,(req,res)=>{
  res.json({message:"access granted",user:req.user})
})

app.get("/api/allsatellite", async (req, res) => {
  try {
    const satellites = await satelliteModel.find();
    if (satellites.length === 0) {
      return res.status(404).json({ message: "No satellites found" });
    }
    res.status(200).json(satellites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch satellites" });
  }
});


app.post("/api/login",async(req,res)=>{
  let {username,password}=req.body;
  let userData=await User.findOne({username})
  let isPasswordValid=bcrypt.compare(password,userData.password)
  
  if(!isPasswordValid){
    return  res.status(401).json({message:"invalid credentials"})
  }

  const token=jwt.sign({username:userData.username},"no-love",{expiresIn:"1h"});
  res.status(200).json({message:"login successfully",token})

})

app.get("/api/satellite", async (req, res) => {
    try {
      const { name, id } = req.query;
      let query = {};
      if (name) query.name = name;
      if (id) query.id = id;
  
      const satellite = await satelliteModel.findOne(query);
      if (!satellite) {
        return res.status(404).json({ message: "Satellite not found" });
      }
      res.status(200).json(satellite);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch satellite" });
    }
  });
  

// DELETE Satellite by ID
app.delete("/api/delsatellite/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the 'id' parameter from the URL
    const result = await satelliteModel.findOneAndDelete({ id });
    if (!result) {
      return res.status(404).json({ message: "Satellite not found" });
    }
    res.status(200).json({ message: "Satellite deleted successfully", deletedSatellite: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete satellite" });
  }
});

// POST API - Add a New Satellite
app.post('/api/addsatellite', async (req, res) => {
    try {
        // Remove noradId from the request body if it exists
        const { noradId, ...satelliteData } = req.body;
        
        // Log incoming request data for debugging
        console.log("Incoming satellite data:", satelliteData);

        const newSatellite = new satelliteModel(satelliteData);
        await newSatellite.save();

        res.status(201).json({ message: "Satellite added successfully", satellite: newSatellite });
    } catch (error) {
        console.error("Error adding satellite:", error);
        res.status(500).json({ message: "Failed to add satellite", error: error.message });
    }
});


// PUT API - Update an Existing Satellite
app.put("/api/updatesatellite/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the 'id' from URL parameters
    const updateData = req.body; // Updated details from the request body

    const updatedSatellite = await satelliteModel.findOneAndUpdate(
      { id },
      updateData,
      { new: true } // Return the updated document
    );

    if (!updatedSatellite) {
      return res.status(404).json({ message: "Satellite not found" });
    }

    res.status(200).json({ message: "Satellite updated successfully", updatedSatellite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update satellite", error: error.message });
  }
});
