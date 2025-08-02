const mongoose = require('mongoose');

const AutoAzykSchema = mongoose.Schema({
    number: String,
    tonnage: {
        type: Number,
        default: 0
   },
    employment: {
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


const AutoAzyk = mongoose.model('AutoAzyk', AutoAzykSchema);

module.exports = AutoAzyk;