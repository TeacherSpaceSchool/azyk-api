const mongoose = require('mongoose');

const EmploymentAzykSchema = mongoose.Schema({
    name: String,
    email: String,
    phone: [String],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    del: String,
}, {
    timestamps: true
});


const EmploymentAzyk = mongoose.model('EmploymentAzyk', EmploymentAzykSchema);

module.exports = EmploymentAzyk;