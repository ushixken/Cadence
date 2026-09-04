const newProject = document.querySelector(".new-project")
const homePage = document.querySelector(".home-page")
const editorPage = document.querySelector(".editor-page")

homePage.style.display = "none"

function homeDisappear(){
  homePage.style.display = "none"
  editorPage.style.display = "flex"
  
}

newProject.addEventListener("click", homeDisappear
)