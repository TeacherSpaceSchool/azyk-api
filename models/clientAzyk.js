const mongoose = require('mongoose');

const ClientAzykSchema = mongoose.Schema({
    name: {
        type: String,
        default: ''
   },
    email: {
        type: String,
        default: ''
   },
    phone: [String],
    address: [[String]],
    sync:  {
        type: [String],
        default: []
   },
    info: {
        type: String,
        default: ''
   },
    lastActive: Date,
    image: String,
    inn: String,
    category: {
        type: String,
        default: 'B'
   },
    city: String,
    device: String,
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAzyk'
   },
    network: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientNetworkAzyk'
   },
    notification: Boolean,
    del: String,
}, {
    timestamps: true
});


const ClientAzyk = mongoose.model('ClientAzyk', ClientAzykSchema);

module.exports = ClientAzyk;