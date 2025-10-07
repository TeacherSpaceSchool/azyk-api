const mongoose = require('mongoose');

const ClientNetworkAzykSchema = mongoose.Schema({
    name: String
}, {
    timestamps: true
});


const ClientNetworkAzyk = mongoose.model('ClientNetworkAzyk', ClientNetworkAzykSchema);

module.exports = ClientNetworkAzyk;