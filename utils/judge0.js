const {getLanguageById, submitBatch, submitToken} = require('../src/utils/problemUtility');

const submitCode = async (code, language, problem) => {
  try {
    if (language === 'cpp') {
      language = 'c++';
    }

    const languageId = getLanguageById(language);
    
    const submissions = problem.hiddenTestCases.map((testcase) => ({
      source_code: code,
      language_id: languageId,
      stdin: testcase.input,
      expected_output: testcase.output
    }));

    const submitResult = await submitBatch(submissions);
    const resultToken = submitResult.map((value) => value.token);
    const testResult = await submitToken(resultToken);

    let testCasesPassed = 0;
    let runtime = 0;
    let memory = 0;
    let status = 'accepted';
    let errorMessage = null;

    for (const test of testResult) {
      if (test.status_id == 3) {
        testCasesPassed++;
        runtime = runtime + parseFloat(test.time);
        memory = Math.max(memory, test.memory);
      } else {
        if (test.status_id == 4) {
          status = 'error';
          errorMessage = test.stderr;
        } else {
          status = 'wrong';
          errorMessage = test.stderr;
        }
      }
    }

    const accepted = (status == 'accepted');
    
    return {
      accepted,
      totalTestCases: problem.hiddenTestCases.length,
      passedTestCases: testCasesPassed,
      runtime,
      memory,
      error: errorMessage
    };

  } catch (error) {
    console.error('Error in judge0 submission:', error);
    return {
      accepted: false,
      totalTestCases: 0,
      passedTestCases: 0,
      runtime: 0,
      memory: 0,
      error: 'Internal server error'
    };
  }
};

module.exports = { submitCode };