const axios = require('axios');


const normalizeLanguage = (lang) => {
  // Handle language aliases
  if(lang==='cpp')
    return 'c++'
  else if(lang==='js')
    return 'javascript'
  else if(lang==='ts')
    return 'typescript'
  else if(lang==='py')
    return 'python'
  else if(lang==='rs')
    return 'rust'
  else if(lang==='rb')
    return 'ruby'
  else if(lang==='kt')
    return 'kotlin'
  else if(lang==='sw')
    return 'swift'
  else if(lang==='golang')
    return 'go'
  else if(lang==='csharp')
    return 'c#'
  else
    return lang
}

const getLanguageById = (lang)=>{
    const normalizedLang = normalizeLanguage(lang);
    
    const language = {
        "c++": 54,
        "java": 62,
        "javascript": 63,
        "python": 71,
        "rust": 73,
        "go": 60,
        "c#": 51,
        "php": 68,
        "ruby": 72,
        "swift": 83,
        "kotlin": 78,
        "typescript": 74,
        "scala": 81,
        "r": 80,
        "dart": 87,
        "elixir": 57,
        "erlang": 58,
        "haskell": 61,
        "lua": 64,
        "perl": 85,
        "bash": 46,
        "c": 50
    }

    return language[normalizedLang.toLowerCase()];
}


const submitBatch = async (submissions)=>{


const options = {
  method: 'POST',
  url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
  params: {
    base64_encoded: 'false'
  },
  headers: {
    'x-rapidapi-key': process.env.JUDGE0_KEY,
    'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
    'Content-Type': 'application/json'
  },
  data: {
    submissions
  }
};

async function fetchData() {
	try {
		const response = await axios.request(options);
		return response.data;
	} catch (error) {
		console.error(error);
	}
}

 return await fetchData();

}


const waiting = async(timer)=>{
  setTimeout(()=>{
    return 1;
  },timer);
}

// ["db54881d-bcf5-4c7b-a2e3-d33fe7e25de7","ecc52a9b-ea80-4a00-ad50-4ab6cc3bb2a1","1b35ec3b-5776-48ef-b646-d5522bdeb2cc"]

const submitToken = async(resultToken)=>{

const options = {
  method: 'GET',
  url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
  params: {
    tokens: resultToken.join(","),
    base64_encoded: 'false',
    fields: '*'
  },
  headers: {
    'x-rapidapi-key': process.env.JUDGE0_KEY,
    'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
  }
};

async function fetchData() {
	try {
		const response = await axios.request(options);
		return response.data;
	} catch (error) {
		console.error(error);
	}
}


 while(true){

 const result =  await fetchData();

  const IsResultObtained =  result.submissions.every((r)=>r.status_id>2);

  if(IsResultObtained)
    return result.submissions;

  
  await waiting(1000);
}



}


module.exports = {getLanguageById, submitBatch, submitToken, normalizeLanguage};








// 


