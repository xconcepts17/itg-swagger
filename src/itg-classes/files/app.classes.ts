<% for(let xclass of classes) {  %>export class <%= xclass.name %> {
 <% for(let properties of xclass.properties) { %> <%=  properties %>; 
 <% } %>
}

<% } %>


