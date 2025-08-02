const mongoose = require('mongoose');

const Integrate1CAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    ecspeditor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    guid: String,
}, {
    timestamps: true
});


const Integrate1CAzyk = mongoose.model('Integrate1CAzyk', Integrate1CAzykSchema);

module.exports = Integrate1CAzyk;