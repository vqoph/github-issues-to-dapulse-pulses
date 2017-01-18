const GithubApi = require('github');
const DapulseApi = require('dapulse');
const fs = require('fs');
const servicesKeys = require('./services-keys.json');
const showdown = require('showdown');
const mdconverter = new showdown.Converter();

const dapulseNoteTitle = 'Github issue content';

const github = new GithubApi({
  // optional
    //debug: true,
    protocol: "https",
    "User-Agent": "blah"
});

github.authenticate({
    type: "token",
    token: servicesKeys.github.token,
});


const dapulse = new DapulseApi({ 
    apiKey: servicesKeys.dapulse.token
});


let promises = [fetchGihubIssues(), fetchDapulseBoard()];

Promise.all(promises).then((result) => { 
    var issues = result[0];
    var pulses = result[1] == "[]" ? [] : result[1];

    fs.writeFileSync('issues/issues.json', JSON.stringify(result[0], null, 4));
    fs.writeFileSync('issues/pulses.json', JSON.stringify(pulses, null, 4));
    
    createPulseIfNotExists(issues,pulses).then((result)=>{
      console.log('sync finished');
    });
}).catch((err) => {
  console.error(err);
});





function fetchGihubIssues(){
  return new Promise((resolve,reject)=>{
    github.issues.getForRepo({
        owner: servicesKeys.github.owner,
        repo: servicesKeys.github.repo,
    }, function(err, res) {
        buildIssueList(res).then((result)=>{
          let issues = result.sort((a,b)=> (parseFloat(a.number) - parseFloat(b.number)));
          resolve(issues);
        },(err)=> reject(err));

    });
  });
}

function buildIssueList(res) {
     return new Promise((resolve,reject)=>{
        let result = res;
        if (github.hasNextPage(res)) {
            github.getNextPage(res, function(err, res) {
              result.forEach((item)=>{res.push(item);});
              buildIssueList(res).then(resolve, reject);
            });
        }else{
          resolve(result);
        }
    });
    
}


function fetchDapulseBoard(){
  return new Promise((resolve,reject)=>{
    dapulse.boards.board_id.pulses({board_id:  servicesKeys.dapulse.board})
    .then(json => resolve(json));
  });
}



function createPulseIfNotExists(issues,pulses){
  return new Promise((resolve,reject)=>{
    issues.forEach((issue)=>{

      let pulseIssue = pulses.filter((pulse)=>{ 
          let issueNumber = parseInt(pulse.pulse.name.split(' ')[0].replace('#',''));
          return issue.number == issueNumber;
       })[0];


      if(issue.state == 'open'){
        if(!!pulseIssue){
          editPulse(issue,pulseIssue).then(resolve).catch(reject);
        }else{     
          createPulse(issue).then((result)=>{
            resolve(result);
          }).catch(err=>reject(err));
        }
      }else{
        console.log('todo close issue', issue.name);
      }

    });
  });
}

function editPulse(issue,pulse){
  return new Promise((resolve,reject)=>{
    dapulse.pulses.id.notes({
      id:pulse.pulse.id
    }).then( notes =>{
      console.log(notes);

      let bodyNote = null;
      if(typeof notes.filter == 'function')
        bodyNote = notes.filter((item)=> item.title == dapulseNoteTitle)[0];

      if(bodyNote){
        dapulse.pulses.id.notes.note_id({
         action: 'put',
         id: pulse.pulse.id,
         user_id: servicesKeys.dapulse.userId,
         note_id: bodyNote.id,
         title: dapulseNoteTitle,
         content: issue.body
         //create_update: true, // optional
        })
        .then(json => { resolve(json); })
        .catch(err => { reject(err); });
      }else{

        dapulse.pulses.id.notes({
          action: 'post',
          id: pulse.pulse.id,
          user_id:servicesKeys.dapulse.userId,
          title: dapulseNoteTitle,
          content:noteIssueContent(issue)
        }).then((result)=>{
          resolve(result);
        })
        .catch(err => { reject(err); });
      }
    });
  });
}


function createPulse(issue){
  return  new Promise((resolve,reject)=>{
    dapulse.boards.board_id.pulses({
      action: 'post',
      board_id: servicesKeys.dapulse.board,
      user_id: servicesKeys.dapulse.userId,
      'pulse[name]': '#'+issue.number+' '+issue.title
     })
    .then(response => { 
        dapulse.pulses.id.notes({
          action: 'post',
          id: response.pulse.id,
          user_id:servicesKeys.dapulse.userId,
          title: dapulseNoteTitle,
          content:noteIssueContent(issue)
        }).then((result)=>{
          resolve(result);
        })
        .catch(err => { reject(err); });
    })
    .catch( err => { 
      reject(err); 
    });
  });
  
}


function noteIssueContent(issue){
  let issueBody = mdconverter.makeHtml(issue.body);
  let noteContent = "";
  noteContent += `<a href="${issue.html_url}">${issue.title}</a><br>`;
  noteContent += `<br>------------------------------------------`;
  noteContent += `<p>${issueBody}</p>`;
  return noteContent;

}