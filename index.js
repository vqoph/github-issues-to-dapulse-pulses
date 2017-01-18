const GithubApi = require('github');
const DapulseApi = require('dapulse');
const serviceConfig = require('./config.json');
const showdown = require('showdown');
const mdconverter = new showdown.Converter();

const dapulseNoteTitle = 'Github issue content';

const github = new GithubApi({
    protocol: "https",
    "User-Agent": "blah"
});

github.authenticate({
    type: "token",
    token: serviceConfig.github.token,
});

const dapulse = new DapulseApi({ 
    apiKey: serviceConfig.dapulse.token
});

let dapulseScriptColumns = [
    { title: 'Issue', type: 'numeric', column_id:'issue' },
    { title: 'Status',type: 'status',  column_id:'status', labels: ['','Open','Closed'] }
];


let promises = [boardColumnsHandler(),fetchGihubIssues(), fetchDapulseBoard()];
Promise.all(promises).then((result) => { 
    var issues = result[1];
    var pulses = result[2] == "[]" ? [] : result[2];
    
    createPulseIfNotExists(issues,pulses).then((result)=>{
      console.log('sync done');
    });
}).catch( (err) => {
  console.error(err);
});


function fetchGihubIssues(){
  return new Promise((resolve,reject)=>{
    github.issues.getForRepo({
        owner: serviceConfig.github.owner,
        repo: serviceConfig.github.repo,
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
    dapulse.boards.board_id.pulses({board_id:  serviceConfig.dapulse.board})
    .then(json => resolve(json));
  });
}


function boardColumnsHandler(){
  return new Promise((resolve,reject)=>{
    dapulse.boards.board_id.columns({board_id:  serviceConfig.dapulse.board })
    .then((columns)=>{
      var promises = [];
      dapulseScriptColumns = dapulseScriptColumns.map((columnDef)=>{
        let matched = columns.filter( col => columnDef.title === col.title );
        console.log(matched);
        if(!matched.length){
          promises.push(createColmunPromise(columnDef));
        }else{
          columnDef.id = matched[0].id;
        }
        return columnDef;
      });
      Promise.all(promises)
        .then(resolve).catch(reject);
    }).catch(reject);
  });
}


function createColmunPromise(colmunDef){
  return new Promise((resolve,reject)=>{
    let buildConfig = Object.assign({}, colmunDef, {
      action: 'post',
      board_id: serviceConfig.dapulse.board,
    });
    dapulse.boards.board_id.columns(buildConfig)
    .then(resolve).catch(reject);
  });
}

function createPulseIfNotExists(issues,pulses){
  return new Promise((resolve,reject)=>{
    issues.forEach((issue)=>{

      let pulseIssue = pulses.filter((pulse)=>{ 
          let issueNumber = parseInt(pulse.pulse.name.split(' ')[0].replace('#',''));
          return issue.number == issueNumber;
       })[0];

    
      if(!!pulseIssue){
        editPulse(issue,pulseIssue).then(resolve).catch(reject);
      }else{     
        createPulse(issue).then(resolve).catch(reject);
      }

    });
  });
}

function editPulse(issue,pulse){
  return new Promise((resolve,reject)=>{
    dapulse.pulses.id({
      action: 'put',
      id: pulse.pulse.id,
      name: pulseName(issue)
     })
    .then(response => { 

      setPulseStatus(pulse, issue).then(()=>{
         dapulse.pulses.id.notes({
          id:pulse.pulse.id
         }).then( notes =>{

          let bodyNote = null;
          if(typeof notes.filter == 'function')
            bodyNote = notes.filter((item)=> item.title == dapulseNoteTitle)[0];

          if(bodyNote){
            dapulse.pulses.id.notes.note_id({
             action: 'put',
             id: pulse.pulse.id,
             user_id: serviceConfig.dapulse.userId,
             note_id: bodyNote.id,
             title: dapulseNoteTitle,
             content: noteIssueContent(issue)
             //create_update: true, // optional
            })
            .then(resolve).catch(reject);
          }else{

            dapulse.pulses.id.notes({
              action: 'post',
              id: pulse.pulse.id,
              user_id:serviceConfig.dapulse.userId,
              title: dapulseNoteTitle,
              content:noteIssueContent(issue)
            }).then(resolve).catch(reject);

          }
        }).catch(reject);
      }).catch(reject);

     

    }).catch(reject);
  });
}


function setPulseStatus(pulse, issue){
    const promise = [];

    let issueConfig = dapulseScriptColumns.find( item => item.column_id == 'issue' );
    
    promises.push(dapulse.boards.board_id.columns.column_id.numeric({
      board_id: serviceConfig.dapulse.board,
      column_id: issueConfig.id,
      pulse_id: pulse.pulse.id,
      value:parseInt(issue.number)
    }));
    
    let statusConfig = dapulseScriptColumns.find( item => item.column_id == 'status' );
    let body = {
      board_id: serviceConfig.dapulse.board,
      column_id: statusConfig.id,
      pulse_id: pulse.pulse.id,
      color_index:((issue.state == 'open') ? 1 : 2)
    };
    promises.push(dapulse.boards.board_id.columns.column_id.status(body));
    
    return Promise.all(promises).catch(console.log);
}

function createPulse(issue){
  return  new Promise((resolve,reject)=>{
    dapulse.boards.board_id.pulses({
      action: 'post',
      board_id: serviceConfig.dapulse.board,
      user_id: serviceConfig.dapulse.userId,
      'pulse[name]': pulseName(issue)
     })
    .then(response => { 
      setPulseStatus(response, issue).then(()=>{
        dapulse.pulses.id.notes({
          action: 'post',
          id: response.pulse.id,
          user_id:serviceConfig.dapulse.userId,
          title: dapulseNoteTitle,
          content:noteIssueContent(issue)
        }).then(resolve).catch(reject);
      });
    })
    .catch( err => { 
      reject(err); 
    });
  });
  
}


function noteIssueContent(issue){
  let issueBody = mdconverter.makeHtml(issue.body.replace(/\n/g, "<br />"));
  let noteContent = "";
  

  noteContent += `<h2>#${issue.number} - ${issue.title}</h2>`;
  noteContent += `<p>${issueBody}</p>`;
  noteContent += `<br>------------------------------------------<br>`;
  noteContent += `<a href="${issue.html_url}">View in github</a> (if repo is private you need an account and authorisation)`;
  return noteContent;
}

function pulseName(issue) {
  return '#'+issue.number+' '+issue.title;
}