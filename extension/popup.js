var xhr = new XMLHttpRequest();
xhr.open("GET", "http://losttime.su/?tmpl=login&token="+localStorage['lostlogin'], true); // ��� ���������� ��� ������ �� ��������� ��������
xhr.onreadystatechange = function() {
  if (xhr.readyState == 4) // ���� �� ������ ������, ���������, ��� � �������
  {
	var dannie = document.getElementById('dannie');
	dannie.innerHTML = xhr.responseText; // ��������� � ���� � id=dannie  ���������� ���
  }
}
xhr.send();