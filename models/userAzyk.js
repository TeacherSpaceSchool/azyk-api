const mongoose = require('mongoose');
const crypto = require('crypto');
const uniqueValidator = require('mongoose-unique-validator');

const userAzykSchema = mongoose.Schema({
    login: {
        type: String,
        required: true,
        unique: true
   },
   // phone: String,
    role: String,
    status: String,
    passwordHash: String,
    salt: String,
}, {
    timestamps: true
});

userAzykSchema.virtual('password')
    .set(function (password) {
        this._plainPassword = password;
        if (password) {
            this.salt = crypto.randomBytes(128).toString('base64');
            this.passwordHash = crypto.pbkdf2Sync(password, this.salt, 1, 128, 'sha1');
       } else {
            this.salt = null;
            this.passwordHash = null;
       }
   })
    .get(function () {
        return this._plainPassword;
   });

userAzykSchema.methods.checkPassword = function (password) {
    if (!password) return false;
    if (!this.passwordHash) return false;
    return crypto.pbkdf2Sync(password, this.salt, 1, 128, 'sha1') == this.passwordHash;
};

userAzykSchema.plugin(uniqueValidator);

const UserAzyk = mongoose.model('UserAzyk', userAzykSchema);
/*
UserAzyk.collection.dropIndex('phone_1', function(err, result) {
    if (err) {
        console.log('Error in dropping index!', err);
   }
});*/

module.exports = UserAzyk;