import axios from "axios";

export async function scrapreGithub(username:string) {
    const userRepos = await axios.get(`https://api.github.com/users/${username}/repos`)
    const filterUserRepos = userRepos.data.map((x: any) => ({
        description: x.description,
        name: x.name,
        fullname: x.full_name,
        starCount: x.stargazers_count
    }))

    return filterUserRepos;
}