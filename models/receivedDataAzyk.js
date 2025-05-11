const mongoose = require('mongoose');

const ReceivedDataAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
    guid: String,
    name: String,
    addres: String,
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
    },
    phone: String,
    type: String,
    status: String,
    position: String,
    category: String,
}, {
    timestamps: true
});

const ReceivedDataAzyk = mongoose.model('ReceivedDataAzyk', ReceivedDataAzykSchema);

module.exports = ReceivedDataAzyk;