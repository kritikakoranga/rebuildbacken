const mongoose = require('mongoose');
const {Schema} = mongoose;

const userSchema = new Schema({
    firstName:{
        type: String,
        required: true,
        minLength:3,
        maxLength:20
    },
    lastName:{
        type:String,
        minLength:3,
        maxLength:20,
    },
    emailId:{
        type:String,
        required:true,
        unique:true,
        trim: true,
        lowercase:true,
        immutable: true,
    },
    age:{
        type:Number,
        min:6,
        max:80,
    },
    role:{
        type:String,
        enum:['user','admin'],
        default: 'user'
    },
    problemSolved:{
        type:[{
            type:Schema.Types.ObjectId,
            ref:'problem',
            unique:true 
        }],
    },
    password:{
        type:String,
        required: function() {
            // Password is required only if not using OAuth
            return !this.googleId && !this.githubId;
        }
    },
    // OAuth fields
    googleId: {
        type: String,
        sparse: true // Allows multiple null values but unique non-null values
    },
    githubId: {
        type: String,
        sparse: true
    },
    profilePicture: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'github'],
        default: 'local'
    }
},{
    timestamps:true
});

userSchema.post('findOneAndDelete', async function (userInfo) {
    if (userInfo) {
      await mongoose.model('submission').deleteMany({ userId: userInfo._id });
    }
});


const User = mongoose.model("user",userSchema);

module.exports = User;
