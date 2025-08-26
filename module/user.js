const UserAzyk = require('../models/userAzyk');
const adminLogin = require('./const').adminLogin,
    adminPass = require('./const').adminPass;

module.exports.createAdmin = async () => {
    await UserAzyk.deleteMany({$or:[{login: adminLogin, role: {$ne: 'admin'}}, {role: 'admin', login: {$ne: adminLogin}}]});
    let findAdmin = await UserAzyk.findOne({login: adminLogin});
    if(!findAdmin) {
        await UserAzyk.create({
            login: adminLogin,
            role: 'admin',
            status: 'active',
            password: adminPass,
       });
   }
    else {
        if(!findAdmin.checkPassword(adminPass)&&findAdmin.login!==adminLogin) {
            if (!findAdmin.checkPassword(adminPass))
                findAdmin.password = adminPass
            if (findAdmin.login !== adminLogin)
                findAdmin.login = adminLogin
            await findAdmin.save()
       }
   }
}