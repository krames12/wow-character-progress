const https = require('https');
const express = require('express');
const access = require('./access');
const app = express();

// setting ejs as templating engine
app.set('view engine', 'ejs');
// allowing access to public folder from the server
app.use('/public', express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/:region/:server/:characterName', (req, res) => {
  var cleanCharacterName = htmlEncode(req.params.characterName),
    blizzRequestUrl = 'https://' + req.params.region + '.api.battle.net/wow/character/' + req.params.server +  '/' + cleanCharacterName + '?fields=progression,items&locale=en_US&apikey=' + access.keys.blizz,
    wclRequestUrl = 'https://www.warcraftlogs.com:443/v1/rankings/character/' + cleanCharacterName + '/' + req.params.server + '/' + req.params.region + '?api_key=' + access.keys.wcl;

	Promise.all([getRequest(blizzRequestUrl, req, res), getRequest(wclRequestUrl, req, res)]).then(sortParsedData).then(function(sortData) {
    res.render('character-info', {info: sortData});
  }).catch((err) => {
    console.log(err);
    res.render('character-404');
  });
});

app.use(function(req, res, next) {
  res.status(404).send('Sorry cant find that!');
});

function getRequest(requestUrl, originReq, originRes) {
  return new Promise((resolve, reject) => {
    https.get(requestUrl, (res) => {
      res.setEncoding('utf8');

      console.log('statusCode:', res.statusCode);
      console.log('headers:', res.headers);
      //console.log('Request made for ' + originReq.params.characterName + ' on the server ' + originReq.params.server);

      // variable for incoming data
      var body = '';

      // parses through data as it's recieved. buffer or not.
      res.on('data', (d) => {
        //process.stdout.write(d);
        body += d;
      });

      // parses the recieved data and sends it to the callback function. also catches any errors.
      res.on('end', () => {
        try {
          var parsed = JSON.parse(body);
        } catch (err) {
          return reject(err);
        }
        console.log("statusCodev2: " + res.statusCode);
        if (res.statusCode !== 404){
          console.log('resolving getRequest');
          resolve(parsed);
        } else {
          reject()
        }
      });

    }).on('error', (err) => {
      reject(err);
    });
  });
}

// check character names for special characters
function htmlEncode(characterName) {
  var n = characterName.length;
  var encoded = [];

  while (n--) {
    var charCode = characterName[n].charCodeAt();
    if (charCode < 65 || charCode > 127 || (charCode > 90 && charCode < 96)) {
      encoded[n] = encodeURI(characterName[n]);
    } else {
      encoded[n] = characterName[n];
    }
  }

  return encoded.join('');
}

// determining character's class based on class id sent from the API
function classIdentity(classId) {
  switch (classId) {
    case 1:
      return "warrior"
    case 2:
      return "paladin"
    case 3:
      return "hunter"
    case 4:
      return "rogue"
    case 5:
      return "priest"
    case 6:
      return "death-knight"
    case 7:
      return "shaman"
    case 8:
      return "mage"
    case 9:
      return "warlock"
    case 10:
      return "monk"
    case 11:
      return "druid"
    case 12:
      return "demon-hunter"
    default:
      return null
  }
}

// determine raid boss ID based on WarcraftLogs seperate ID
function wclBossId(bossId) {
  // Emerald Nightmare Boss Id's
  switch(bossId) {
    case "Nythendra":
      return 1853
    case "Nythendra":
      return 1873
    case "Elerethe Renferal":
      return 1876
    case "Ursoc":
      return 1841
    case "Dragons of Nightmare":
      return 1854
    case "Cenarius":
      return 1877
    case "Xavius":
      return 1864
  }
}

// overall sorting and filtering of data
function sortParsedData(data) {
  // sorting out character info and progress info
  var sortData = {
    name: data[0].name,
    class: classIdentity(data[0].class),
    realm: data[0].realm,
    itemLevel: data[0].items.averageItemLevel,
    progress: data[0].progression.raids
      .filter((item, index) => {
        if(item.name == "The Emerald Nightmare") {
          return item;
        }
      })
      .map((item, index) => {
        return {
          name: item.name,
          bosses: item.bosses.map((item, index) => {
            return {
              name: item.name,
              bossId: wclBossId(item.name),
              lfrKills: item.lfrKills,
              normalKills: item.normalKills,
              heroicKills: item.heroicKills,
              mythicKills: item.mythicKills
            }
          }),
          totalBosses: bossTotal(item.bosses),
          lfrProgress: difficultyProgress("lfr", item),
          normalProgress: difficultyProgress("normal", item),
          heroicProgress: difficultyProgress("heroic", item),
          mythicProgress: difficultyProgress("mythic", item)
        };
      })
  };
  
  
  
  console.log('sortData', data[1]);
  return sortData;
}


// Obtains total bosses in an instance
function bossTotal(bossData) {
  var bossCount = 0;

  for(var b = 0; b < bossData.length; b++) {
    bossCount++;
  }

  return bossCount;
}

// Obtains bosses killed for a given raid difficulty
function difficultyProgress (difficulty, bossData) {
  var killSearch = difficulty + "Kills";
  var progress = 0;

  for (var b = 0; b < bossData.bosses.length; b++) {
    if(bossData.bosses[b][killSearch] > 0) {
      progress++;
    }
  }

  return progress;
}

// calculate ranking percentile
function calculatePercentile(actualRank, totalRanked) {
  var percentage = Math.floor((actualRank / totalRanked) * 100);
  return Math.round((100 - percentage));
}

app.listen(8080, () => {
    console.log('app is listening to port 8080');
});
