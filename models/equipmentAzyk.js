const mongoose = require('mongoose');

const EquipmentAzykSchema = mongoose.Schema({
    number: String,
    model: String,
    image: String,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
}, {
    timestamps: true
});


const EquipmentAzyk = mongoose.model('EquipmentAzyk', EquipmentAzykSchema);

module.exports = EquipmentAzyk;