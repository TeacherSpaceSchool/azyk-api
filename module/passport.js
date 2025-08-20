const passport = require('passport');
const LocalStrategy = require('passport-local');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwtsecret = '@615141ViDiK141516@';
const UserAzyk = require('../models/userAzyk');
const ClientAzyk = require('../models/clientAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
const jwt = require('jsonwebtoken');
const {unawaited} = require('./const');
const {roleList} = require('./enum');

let start = () => {
//настройка паспорта
    passport.use(new LocalStrategy({
            usernameField: 'login',
            passwordField: 'password',
            session: false
       },
        function (login, password, done) {
            UserAzyk.findOne({login: login}, (err, user) => {
                if (err) {
                    return done(err);
               }

                if (user && user.status==='active' && (
                    process.env.URL.trim()!=='https://azyk.store'||
                    user.checkPassword(password))
                ) {
                    return done(null, user);
               }
                return done(null, false, {message: 'Нет такого пользователя или пароль неверен.'});
           });
       })
    );
    const jwtOptions = {};
    jwtOptions.jwtFromRequest= ExtractJwt.fromAuthHeaderAsBearerToken();
    jwtOptions.secretOrKey=jwtsecret;
    passport.use(new JwtStrategy(jwtOptions, function (payload, done) {
        UserAzyk.findOne({login:payload.login}, (err, user) => {
            if (err) {
                return done(err)
           }
            if (user) {
                return done(null, user)
           } else {
                return done(null, false)
           }}
        ).lean()
   }));
}

const verifydrole = async (req, res, func) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                await func(user.role)
           } else {
                console.error('No such user')
                res.status(401);
                res.end('No such user');
           }
       } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
       }
   } )(req, res)
}

const verifydeuser = async (req, res, func) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                await func(user)
           } else {
                console.error('No such user')
                res.status(401);
                res.end('No such user');
           }
       } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
       }
   } )(req, res)
}

const getuser = async (req, res, func) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            await func(user)

       } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
       }
   } )(req, res)
}

const verifydeuserGQL = async (req, res) => {
    // eslint-disable-next-line no-undef
    return new Promise((resolve) => {passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                if(user.role===roleList.admin)
                    resolve(user)
                else if(user.role===roleList.client) {
                    const client = await ClientAzyk.findOne({user: user._id}).select('_id name category city').lean()
                    user.client = client._id
                    user.name = client.name
                    user.category = client.category
                    user.city = client.city
                    unawaited(async() => await ClientAzyk.updateOne({user: user._id}, {lastActive: new Date()}))
                    resolve(user)

               }
                else if(['суперагент', 'суперменеджер', 'суперэкспедитор'].includes(user.role)) {
                    let employment = await EmploymentAzyk.findOne({user: user._id}).select('_id name').lean()
                    user.employment = employment._id
                    user.name = employment.name
                    user.agentHistory = 100
                    resolve(user)
               }
                else {
                    let employment = await EmploymentAzyk.findOne({user: user._id})
                        .select('_id name organization')
                        .populate({path: 'organization', select: '_id onlyIntegrate clientDuplicate onlyDistrict agentSubBrand status addedClient cities agentHistory'}).lean()
                    if(employment.organization.status==='active') {
                        user.employment = employment._id
                        user.name = employment.name
                        user.organization = employment.organization._id
                        user.onlyIntegrate = employment.organization.onlyIntegrate
                        user.clientDuplicate = employment.organization.clientDuplicate
                        user.onlyDistrict = employment.organization.onlyDistrict
                        user.addedClient = employment.organization.addedClient
                        user.agentSubBrand = employment.organization.agentSubBrand
                        user.agentHistory = employment.organization.agentHistory
                        user.cities = employment.organization.cities
                        user.city = employment.organization.cities[0]
                        resolve(user)
                   }
                    else {
                        resolve({})
                   }
               }
           } else {
                resolve({})
           }
       } catch (err) {
            console.error(err)
            resolve({})
       }
   } )(req, res)
   })


}

const signinuser = (req, res) => {
    passport.authenticate('local', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                const payload = {
                    _id: user._id,
                    login: user.login,
                    status: user.status,
                    role: user.role
               };
                const token = await jwt.sign(payload, jwtsecret); //здесь создается JWT
                await res.status(200);
                await res.clearCookie('jwt');
                await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000, sameSite: 'Lax' , secure: true}).end(token);
           } else {
                res.status(401);
                res.end('Login failed',401)
           }
       } catch (err) {
            console.error(err)
            res.status(401);
            res.end('login not be unique')
       }
   })(req, res);
}

const getstatus = async (req, res) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                res.status(200);
                res.end(JSON.stringify({status: user.status, role: user.role, _id: user._id}))
           } else {
                console.error('No such user')
                res.status(401);
                res.end('No such user');
           }
       } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
       }
   } )(req, res)

}

const signinuserGQL = (req, res) => {
    // eslint-disable-next-line no-undef
    return new Promise((resolve) => {
        passport.authenticate('local', async function (err, user) {
            try{
                if (user&&user.status==='active') {
                    const payload = {
                        _id: user._id,
                        login: user.login,
                        status: user.status,
                        role: user.role
                   };
                    const token = await jwt.sign(payload, jwtsecret); //здесь создается JWT
                    await res.clearCookie('jwt');
                    await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000, sameSite: 'Lax' , secure: true});
                    if(![roleList.admin, roleList.client].includes(user.role)) {
                        let employment = await EmploymentAzyk.findOne({user: user._id}).select('organization').lean()
                        user.organization = employment.organization
                   }
                    resolve({
                        role: user.role,
                        status: user.status,
                        login: user.login,
                        organization: user.organization,
                        _id: user._id
                   })
               } else {
                    resolve({role: 'Проверьте данные'})
               }
           } catch (err) {
                console.error(err)
                resolve({role: 'Проверьте данные'})
           }
       })(req, res);
   })
}

const createJwtGQL = async (res, user) => {
    const payload = {
        _id: user._id,
        login: user.login,
        status: user.status,
        role: user.role
   };
    const token = await jwt.sign(payload, jwtsecret); //здесь создается JWT
    await res.clearCookie('jwt');
    await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000, sameSite: 'Lax' , secure: true});
}

module.exports.getuser = getuser;
module.exports.createJwtGQL = createJwtGQL;
module.exports.verifydrole = verifydrole;
module.exports.getstatus = getstatus;
module.exports.verifydeuserGQL = verifydeuserGQL;
module.exports.start = start;
module.exports.verifydeuser = verifydeuser;
module.exports.signinuser = signinuser;
module.exports.signinuserGQL = signinuserGQL;
