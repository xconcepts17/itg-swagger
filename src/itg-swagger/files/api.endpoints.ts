import { AppConfig } from "./app.config";

export class ApiEndpoint {
  public static path = {
    <% for(let tag of endPoints) {  %><%=  tag.tag %> : {
      <% for(let path of tag.paths) { %> <%=  path %>, 
      <% } %>
    },
    <% } %>
  };
}
