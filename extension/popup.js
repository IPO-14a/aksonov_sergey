var xhr = new XMLHttpRequest();
xhr.open("GET", "http://losttime.su/?tmpl=login&token="+localStorage['lostlogin'], true); // тут происходит ГЕТ запрос на указанную страницу
xhr.onreadystatechange = function() {
  if (xhr.readyState == 4) // если всё прошло хорошо, выполняем, что в скобках
  {
	var dannie = document.getElementById('dannie');
	dannie.innerHTML = xhr.responseText; // добавляем в блок с id=dannie  полученный код
  }
}
xhr.send();